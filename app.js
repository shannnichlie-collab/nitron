/* =========================================================
   NITRON RACING V5
   GPS + TELEMETRY + RACING SYSTEM
========================================================= */

"use strict";


/* =========================================================
   STORAGE
========================================================= */

const STORAGE_KEY = "nitron-racing-v5";

const defaultData = {

    settings: {

        unit: "kmh",

        warningSpeed: 100,

        criticalSpeed: 120,

        autoCenter: true,

        vibration: true,

        startup: true
    },

    rides: [],

    vehicles: [

        {
            id: Date.now(),
            name: "Yamaha R15",
            model: "R15 V2",
            engine: "155 cc",
            odometer: 0,
            active: true
        }

    ],

    maintenance: [],

    expenses: [],

    records: {

        topSpeed: 0,

        best60: null,

        best100: null,

        totalDistance: 0
    }

};


let data = loadData();


function loadData() {

    try {

        const saved =
            localStorage.getItem(STORAGE_KEY);

        if (!saved) {

            return structuredClone(defaultData);
        }

        const parsed =
            JSON.parse(saved);

        return {

            ...structuredClone(defaultData),

            ...parsed,

            settings: {

                ...defaultData.settings,

                ...(parsed.settings || {})
            },

            records: {

                ...defaultData.records,

                ...(parsed.records || {})
            }

        };

    } catch (error) {

        console.error(
            "Storage load error:",
            error
        );

        return structuredClone(defaultData);
    }
}


function saveData() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

    } catch (error) {

        console.error(
            "Storage save error:",
            error
        );
    }
}


/* =========================================================
   STATE
========================================================= */

const state = {

    gpsWatching: false,

    watchId: null,

    gpsLocked: false,

    lastGPSUpdate: null,

    gpsUpdates: 0,

    lastPosition: null,

    previousPosition: null,

    speed: 0,

    rawSpeed: 0,

    maxSpeed: 0,

    averageSpeed: 0,

    distanceKm: 0,

    movingSeconds: 0,

    stoppedSeconds: 0,

    rideSeconds: 0,

    rideRunning: false,

    ridePaused: false,

    rideStartTime: null,

    lastTimerTick: null,

    lastMovingTick: null,

    route: [],

    waypoints: [],

    telemetry: [],

    speedHistory: [],

    accelHistory: [],

    altitudeHistory: [],

    currentGraph: "speed",

    accelerationG: 0,

    maxAccelerationG: 0,

    maxDecelerationG: 0,

    demoMode: false,

    demoTimer: null,

    raceRunning: false,

    raceStartTime: null,

    raceDistance: 0,

    raceMaxSpeed: 0,

    raceTimes: {

        30: null,

        60: null,

        80: null,

        100: null
    },

    tests: {

        30: null,

        60: null,

        80: null,

        100: null
    },

    wakeLock: null,

    audioContext: null,

    lastWarningTime: 0,

    lastSpeedForAccel: 0,

    lastSpeedTimestamp: null,

    map: null,

    marker: null,

    routeLine: null,

    startMarker: null,

    mapReady: false
};


/* =========================================================
   DOM
========================================================= */

const $ = selector =>
    document.querySelector(selector);

const $$ = selector =>
    document.querySelectorAll(selector);


/* =========================================================
   STARTUP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeApp();

    }
);


async function initializeApp() {

    applySettings();

    setupNavigation();

    setupButtons();

    setupGraphButtons();

    setupModals();

    renderHistory();

    renderGarage();

    renderMaintenance();

    renderExpenses();

    updateRecords();

    drawGraph();

    createSpeedometerTicks();

    if (data.settings.startup) {

        await runStartup();

    } else {

        hideSplash();
    }

    startGPS();

    initializeMap();

    updateSystemStatus();

    setInterval(
        updateClock,
        500
    );

    setInterval(
        updateSignalAge,
        500
    );
}


/* =========================================================
   STARTUP
========================================================= */

function runStartup() {

    return new Promise(resolve => {

        const splash =
            $("#splashScreen");

        const progress =
            $("#loadingProgress");

        const text =
            $("#loadingText");

        const steps = [

            {
                id: "bootGPS",
                text: "GPS SYSTEM",
                delay: 450
            },

            {
                id: "bootTelemetry",
                text: "TELEMETRY",
                delay: 700
            },

            {
                id: "bootRace",
                text: "RACE ENGINE",
                delay: 900
            },

            {
                id: "bootData",
                text: "DATA SYSTEM",
                delay: 1100
            }

        ];

        let index = 0;

        const interval =
            setInterval(() => {

                if (index < steps.length) {

                    const step =
                        steps[index];

                    const element =
                        $("#" + step.id);

                    if (element) {

                        element.textContent =
                            "OK";

                    }

                    progress.style.width =
                        ((index + 1) /
                            steps.length * 100) + "%";

                    text.textContent =
                        step.text +
                        " READY";

                    index++;

                } else {

                    clearInterval(interval);

                    progress.style.width =
                        "100%";

                    text.textContent =
                        "SYSTEM READY";

                    setTimeout(() => {

                        hideSplash();

                        resolve();

                    }, 700);
                }

            }, 500);


        $("#skipIntro")
            .addEventListener(
                "click",
                () => {

                    clearInterval(interval);

                    hideSplash();

                    resolve();
                }
            );

    });
}


function hideSplash() {

    const splash =
        $("#splashScreen");

    if (!splash) return;

    splash.style.transition =
        "opacity .6s ease";

    splash.style.opacity = "0";

    setTimeout(() => {

        splash.remove();

        $("#app")
            .classList
            .remove("hidden");

    }, 600);
}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    $$(".nav-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;

                    $$(".nav-btn")
                        .forEach(btn =>
                            btn.classList
                                .remove("active")
                        );

                    button.classList
                        .add("active");

                    $$(".page")
                        .forEach(p =>
                            p.classList
                                .remove("active-page")
                        );

                    const target =
                        $("#" + page + "Page");

                    if (target) {

                        target.classList
                            .add("active-page");
                    }

                    if (page === "map") {

                        setTimeout(() => {

                            if (state.map) {

                                state.map.invalidateSize();

                            }

                        }, 150);
                    }
                }
            );

        });
}


/* =========================================================
   BUTTONS
========================================================= */

function setupButtons() {

    $("#startRideBtn")
        .addEventListener(
            "click",
            startRide
        );

    $("#pauseRideBtn")
        .addEventListener(
            "click",
            togglePause
        );

    $("#finishRideBtn")
        .addEventListener(
            "click",
            finishRide
        );

    $("#resetRideBtn")
        .addEventListener(
            "click",
            () => {

                if (
                    state.rideRunning ||
                    state.distanceKm > 0
                ) {

                    if (
                        confirm(
                            "Reset the current ride?"
                        )
                    ) {

                        resetRide();
                    }

                } else {

                    resetRide();
                }
            }
        );

    $("#resetTestsBtn")
        .addEventListener(
            "click",
            resetTests
        );

    $("#fullscreenBtn")
        .addEventListener(
            "click",
            toggleFullscreen
        );

    $("#settingsBtn")
        .addEventListener(
            "click",
            () =>
                openModal(
                    "settingsModal"
                )
        );

    $("#wakeLockBtn")
        .addEventListener(
            "click",
            toggleWakeLock
        );

    $("#soundBtn")
        .addEventListener(
            "click",
            enableSound
        );

    $("#demoBtn")
        .addEventListener(
            "click",
            toggleDemoMode
        );

    $("#emergencyBtn")
        .addEventListener(
            "click",
            openEmergency
        );

    $("#centerMapBtn")
        .addEventListener(
            "click",
            centerMap
        );

    $("#markWaypointBtn")
        .addEventListener(
            "click",
            markWaypoint
        );

    $("#clearRouteBtn")
        .addEventListener(
            "click",
            clearRoute
        );

    $("#raceStartBtn")
        .addEventListener(
            "click",
            startRace
        );

    $("#clearHistoryBtn")
        .addEventListener(
            "click",
            clearHistory
        );

    $("#exportAllBtn")
        .addEventListener(
            "click",
            exportAllRides
        );

    $("#addVehicleBtn")
        .addEventListener(
            "click",
            addVehicle
        );

    $("#addMaintenanceBtn")
        .addEventListener(
            "click",
            addMaintenance
        );

    $("#addExpenseBtn")
        .addEventListener(
            "click",
            addExpense
        );

    $("#copyLocationBtn")
        .addEventListener(
            "click",
            copyLocation
        );

    $("#openLocationBtn")
        .addEventListener(
            "click",
            openLocation
        );

    $("#backupBtn")
        .addEventListener(
            "click",
            exportBackup
        );

    $("#restoreBtn")
        .addEventListener(
            "click",
            importBackup
        );

    $("#resetSettingsBtn")
        .addEventListener(
            "click",
            resetSettings
        );

    $("#unitSelect")
        .addEventListener(
            "change",
            saveSettings
        );

    $("#warningSpeed")
        .addEventListener(
            "change",
            saveSettings
        );

    $("#criticalSpeed")
        .addEventListener(
            "change",
            saveSettings
        );

    $("#autoCenter")
        .addEventListener(
            "change",
            saveSettings
        );

    $("#vibrationEnabled")
        .addEventListener(
            "change",
            saveSettings
        );

    $("#startupEnabled")
        .addEventListener(
            "change",
            saveSettings
        );

    document.addEventListener(
        "click",
        event => {

            const close =
                event.target
                    .closest("[data-close]");

            if (close) {

                closeModal(
                    close.dataset.close
                );
            }

        }
    );
}


/* =========================================================
   SETTINGS
========================================================= */

function applySettings() {

    $("#unitSelect").value =
        data.settings.unit;

    $("#warningSpeed").value =
        data.settings.warningSpeed;

    $("#criticalSpeed").value =
        data.settings.criticalSpeed;

    $("#autoCenter").checked =
        data.settings.autoCenter;

    $("#vibrationEnabled").checked =
        data.settings.vibration;

    $("#startupEnabled").checked =
        data.settings.startup;

    updateUnitLabels();
}


function saveSettings() {

    data.settings.unit =
        $("#unitSelect").value;

    data.settings.warningSpeed =
        clamp(
            Number(
                $("#warningSpeed").value
            ),
            10,
            240
        );

    data.settings.criticalSpeed =
        clamp(
            Number(
                $("#criticalSpeed").value
            ),
            10,
            240
        );

    data.settings.autoCenter =
        $("#autoCenter").checked;

    data.settings.vibration =
        $("#vibrationEnabled").checked;

    data.settings.startup =
        $("#startupEnabled").checked;

    saveData();

    updateUnitLabels();

    notify(
        "Settings saved"
    );
}


function resetSettings() {

    data.settings =
        structuredClone(
            defaultData.settings
        );

    saveData();

    applySettings();

    notify(
        "Settings restored"
    );
}


function updateUnitLabels() {

    const unit =
        data.settings.unit === "mph"
            ? "MPH"
            : "KM/H";

    $("#speedUnit").textContent =
        unit;

    $("#raceUnit").textContent =
        unit;

    $$(".unit-label")
        .forEach(el => {

            el.textContent =
                unit;
        });
}


/* =========================================================
   GPS
========================================================= */

function startGPS() {

    if (
        !navigator.geolocation
    ) {

        notify(
            "GPS is not supported",
            "!"
        );

        return;
    }

    if (state.gpsWatching) {
        return;
    }

    state.gpsWatching = true;

    $("#systemGPS").textContent =
        "STARTING";

    state.watchId =
        navigator.geolocation.watchPosition(
            handleGPS,
            handleGPSError,
            {
                enableHighAccuracy: true,

                maximumAge: 1000,

                timeout: 10000
            }
        );
}


function handleGPS(position) {

    state.gpsLocked = true;

    state.gpsUpdates++;

    state.lastGPSUpdate =
        Date.now();

    const coords =
        position.coords;

    const lat =
        coords.latitude;

    const lon =
        coords.longitude;

    const accuracy =
        Number.isFinite(
            coords.accuracy
        )
            ? coords.accuracy
            : null;

    let speed =
        Number.isFinite(
            coords.speed
        ) && coords.speed >= 0
            ? coords.speed * 3.6
            : null;

    let calculatedSpeed = null;

    if (
        state.lastPosition
    ) {

        const dt =
            (Date.now() -
                state.lastPosition.time) /
            1000;

        const distance =
            haversineDistance(
                state.lastPosition.lat,
                state.lastPosition.lon,
                lat,
                lon
            );

        if (
            dt > 0 &&
            distance >= 0
        ) {

            calculatedSpeed =
                distance /
                (dt / 3600);
        }

        if (
            state.rideRunning &&
            !state.ridePaused &&
            accuracy !== null &&
            accuracy < 50
        ) {

            if (
                distance > 0.001 &&
                distance < 1
            ) {

                state.distanceKm +=
                    distance;

                state.route.push({
                    lat,
                    lon,
                    time: Date.now(),
                    speed:
                        speed ??
                        calculatedSpeed ??
                        0,
                    altitude:
                        coords.altitude ??
                        null,
                    accuracy
                });

                drawRoute();
            }
        }
    }

    if (
        speed === null ||
        speed > 250 ||
        speed < 0
    ) {

        speed =
            calculatedSpeed ?? 0;
    }

    if (
        accuracy !== null &&
        accuracy > 100
    ) {

        speed =
            Math.min(
                speed,
                state.speed
            );
    }

    speed =
        smoothSpeed(speed);

    updateTelemetry(
        lat,
        lon,
        coords.altitude,
        accuracy,
        coords.heading,
        speed
    );

    state.lastPosition = {

        lat,
        lon,

        time: Date.now()
    };

    updateMapPosition(
        lat,
        lon
    );

    if (
        state.rideRunning &&
        !state.ridePaused
    ) {

        recordTelemetry(
            lat,
            lon,
            coords.altitude,
            accuracy,
            coords.heading,
            speed
        );
    }

    updateUI();
}


function handleGPSError(error) {

    state.gpsLocked = false;

    $("#systemGPS").textContent =
        "NO SIGNAL";

    $("#gpsTopStatus")
        .innerHTML =
        "<i></i> GPS LOST";

    $("#gpsQualityBadge")
        .textContent =
        "NO SIGNAL";

    notify(
        "GPS signal unavailable",
        "!"
    );

    console.warn(
        "GPS error:",
        error
    );
}


function smoothSpeed(value) {

    if (!Number.isFinite(value)) {
        return state.speed;
    }

    const difference =
        value - state.speed;

    const maxChange =
        30;

    if (
        Math.abs(difference) >
        maxChange
    ) {

        value =
            state.speed +
            Math.sign(difference) *
            maxChange;
    }

    return state.speed * .65 +
        value * .35;
}


/* =========================================================
   TELEMETRY
========================================================= */

function updateTelemetry(
    lat,
    lon,
    altitude,
    accuracy,
    heading,
    speed
) {

    const previousSpeed =
        state.speed;

    state.rawSpeed =
        speed;

    state.speed =
        Math.max(
            0,
            speed
        );

    if (
        state.speed >
        state.maxSpeed
    ) {

        state.maxSpeed =
            state.speed;
    }

    calculateAcceleration(
        previousSpeed,
        state.speed
    );

    if (
        state.speed >
        2
    ) {

        state.movingSeconds++;
    } else {

        state.stoppedSeconds++;
    }

    if (
        state.rideRunning &&
        !state.ridePaused
    ) {

        state.rideSeconds++;
    }

    $("#latitude").textContent =
        Number.isFinite(lat)
            ? lat.toFixed(6)
            : "--";

    $("#longitude").textContent =
        Number.isFinite(lon)
            ? lon.toFixed(6)
            : "--";

    $("#altitude").textContent =
        Number.isFinite(altitude)
            ? altitude.toFixed(1) + " m"
            : "-- m";

    $("#accuracy").textContent =
        Number.isFinite(accuracy)
            ? accuracy.toFixed(1) + " m"
            : "-- m";

    $("#heading").textContent =
        Number.isFinite(heading)
            ? Math.round(heading) + "°"
            : "--°";

    $("#gpsSpeed").textContent =
        formatSpeed(
            state.rawSpeed
        );

    $("#gpsUpdates").textContent =
        state.gpsUpdates;

    updateGPSQuality(
        accuracy
    );

    updateSpeedDisplay();

    updateAccelerationDisplay();

    updatePerformanceTests();

    updateWarning();
}


function calculateAcceleration(
    previousSpeed,
    currentSpeed
) {

    const now =
        Date.now();

    if (
        state.lastSpeedTimestamp
    ) {

        const dt =
            (now -
                state.lastSpeedTimestamp) /
            1000;

        if (
            dt > 0 &&
            dt < 5
        ) {

            const ms1 =
                previousSpeed /
                3.6;

            const ms2 =
                currentSpeed /
                3.6;

            const acceleration =
                (ms2 - ms1) /
                dt;

            state.accelerationG =
                acceleration /
                9.80665;

            state.maxAccelerationG =
                Math.max(
                    state.maxAccelerationG,
                    state.accelerationG
                );

            state.maxDecelerationG =
                Math.min(
                    state.maxDecelerationG,
                    state.accelerationG
                );
        }
    }

    state.lastSpeedTimestamp =
        now;
}


/* =========================================================
   GPS QUALITY
========================================================= */

function updateGPSQuality(
    accuracy
) {

    const badge =
        $("#gpsQualityBadge");

    if (
        !state.gpsLocked
    ) {

        badge.textContent =
            "NO SIGNAL";

        return;
    }

    let quality;

    if (
        accuracy !== null &&
        accuracy <= 5
    ) {

        quality = "EXCELLENT";

    } else if (
        accuracy !== null &&
        accuracy <= 10
    ) {

        quality = "GOOD";

    } else if (
        accuracy !== null &&
        accuracy <= 25
    ) {

        quality = "FAIR";

    } else {

        quality = "POOR";
    }

    badge.textContent =
        quality;

    $("#gpsTopStatus")
        .innerHTML =
        `<i></i> GPS ${quality}`;

    $("#systemGPS").textContent =
        quality;
}


/* =========================================================
   RIDE CONTROL
========================================================= */

function startRide() {

    if (
        state.rideRunning &&
        !state.ridePaused
    ) {

        notify(
            "Ride already running"
        );

        return;
    }

    if (
        state.ridePaused
    ) {

        state.ridePaused =
            false;

        state.lastTimerTick =
            Date.now();

        notify(
            "Ride resumed"
        );

        return;
    }

    clearRideData();

    state.rideRunning =
        true;

    state.ridePaused =
        false;

    state.rideStartTime =
        Date.now();

    state.lastTimerTick =
        Date.now();

    $("#rideStatus").textContent =
        "RECORDING";

    notify(
        "Ride recording started"
    );

    vibrate(
        [100, 50, 100]
    );
}


function togglePause() {

    if (!state.rideRunning) {

        notify(
            "No active ride",
            "!"
        );

        return;
    }

    state.ridePaused =
        !state.ridePaused;

    $("#rideStatus").textContent =
        state.ridePaused
            ? "PAUSED"
            : "RECORDING";

    notify(
        state.ridePaused
            ? "Ride paused"
            : "Ride resumed"
    );
}


function finishRide() {

    if (
        !state.rideRunning &&
        state.distanceKm <= 0
    ) {

        notify(
            "No ride to finish",
            "!"
        );

        return;
    }

    state.rideRunning =
        false;

    state.ridePaused =
        false;

    const ride = {

        id: Date.now(),

        date:
            new Date().toISOString(),

        distance:
            state.distanceKm,

        maxSpeed:
            state.maxSpeed,

        averageSpeed:
            calculateAverageSpeed(),

        duration:
            state.rideSeconds,

        moving:
            state.movingSeconds,

        stopped:
            state.stoppedSeconds,

        maxAcceleration:
            state.maxAccelerationG,

        maxDeceleration:
            state.maxDecelerationG,

        route:
            [...state.route],

        waypoints:
            [...state.waypoints],

        tests:
            {...state.tests}
    };

    data.rides.unshift(
        ride
    );

    updateRecordsFromRide(
        ride
    );

    saveData();

    renderHistory();

    updateRecords();

    notify(
        "Ride saved successfully"
    );

    vibrate(
        [150, 100, 150]
    );

    resetRide(false);
}


function resetRide(showNotification = true) {

    state.rideRunning =
        false;

    state.ridePaused =
        false;

    state.rideStartTime =
        null;

    state.lastTimerTick =
        null;

    state.speed =
        0;

    state.rawSpeed =
        0;

    state.maxSpeed =
        0;

    state.averageSpeed =
        0;

    state.distanceKm =
        0;

    state.movingSeconds =
        0;

    state.stoppedSeconds =
        0;

    state.rideSeconds =
        0;

    state.route = [];

    state.waypoints = [];

    state.telemetry = [];

    state.speedHistory = [];

    state.accelHistory = [];

    state.altitudeHistory = [];

    state.accelerationG =
        0;

    state.maxAccelerationG =
        0;

    state.maxDecelerationG =
        0;

    state.lastSpeedTimestamp =
        null;

    resetTests();

    clearMapRoute();

    updateUI();

    if (showNotification) {

        notify(
            "Ride reset"
        );
    }
}


function clearRideData() {

    state.distanceKm =
        0;

    state.maxSpeed =
        0;

    state.averageSpeed =
        0;

    state.movingSeconds =
        0;

    state.stoppedSeconds =
        0;

    state.rideSeconds =
        0;

    state.route = [];

    state.waypoints = [];

    state.telemetry = [];

    state.speedHistory = [];

    state.accelHistory = [];

    state.altitudeHistory = [];

    state.maxAccelerationG =
        0;

    state.maxDecelerationG =
        0;

    resetTests();

    clearMapRoute();
}


/* =========================================================
   TIMER
========================================================= */

function updateClock() {

    if (
        state.rideRunning &&
        !state.ridePaused
    ) {

        if (
            state.lastTimerTick
        ) {

            const elapsed =
                Math.floor(
                    (
                        Date.now() -
                        state.lastTimerTick
                    ) / 1000
                );

            if (
                elapsed > 0
            ) {

                state.rideSeconds +=
                    elapsed;

                if (
                    state.speed > 2
                ) {

                    state.movingSeconds +=
                        elapsed;

                } else {

                    state.stoppedSeconds +=
                        elapsed;
                }

                state.lastTimerTick =
                    Date.now();
            }
        }
    }

    $("#rideTime").textContent =
        formatTime(
            state.rideSeconds
        );

    $("#movingTime").textContent =
        formatTime(
            state.movingSeconds
        );

    $("#stoppedTime").textContent =
        formatTime(
            state.stoppedSeconds
        );

    const now =
        Date.now();

    if (
        state.lastGPSUpdate &&
        now -
        state.lastGPSUpdate >
        5000
    ) {

        $("#signalAge").textContent =
            Math.floor(
                (
                    now -
                    state.lastGPSUpdate
                ) / 1000
            ) + "s";
    }
}


/* =========================================================
   SIGNAL AGE
========================================================= */

function updateSignalAge() {

    if (
        !state.lastGPSUpdate
    ) {

        $("#signalAge").textContent =
            "--";

        return;
    }

    const age =
        Math.max(
            0,
            Math.floor(
                (
                    Date.now() -
                    state.lastGPSUpdate
                ) / 1000
            )
        );

    $("#signalAge").textContent =
        age + "s";
}


/* =========================================================
   UI
========================================================= */

function updateUI() {

    updateSpeedDisplay();

    $("#maxSpeed").textContent =
        formatDisplaySpeed(
            state.maxSpeed
        );

    $("#avgSpeed").textContent =
        formatDisplaySpeed(
            calculateAverageSpeed()
        );

    $("#distanceValue").textContent =
        state.distanceKm.toFixed(2);

    $("#mapSpeed").textContent =
        Math.round(
            convertSpeed(
                state.speed
            )
        );

    $("#mapDistance").textContent =
        state.distanceKm.toFixed(2);

    $("#routePoints").textContent =
        state.route.length;

    $("#routeDistance").textContent =
        state.distanceKm.toFixed(2) +
        " km";

    $("#waypointCount").textContent =
        state.waypoints.length;

    $("#accelValue").textContent =
        (
            state.accelerationG >= 0
                ? "+"
                : ""
        ) +
        state.accelerationG.toFixed(2) +
        " G";

    $("#speedState").textContent =
        getSpeedState();

    $("#raceSpeed").textContent =
        Math.round(
            convertSpeed(
                state.speed
            )
        );

    $("#raceMax").textContent =
        Math.round(
            convertSpeed(
                state.raceMaxSpeed
            )
        );

    $("#raceDistance").textContent =
        state.raceDistance.toFixed(1) +
        " m";

    updateTestsUI();

    drawGraph();
}


function updateSpeedDisplay() {

    const displaySpeed =
        convertSpeed(
            state.speed
        );

    $("#speedValue").textContent =
        Math.round(
            displaySpeed
        );

    const percentage =
        clamp(
            state.speed /
            240,
            0,
            1
        );

    const degrees =
        -120 +
        percentage * 240;

    $("#speedNeedle").style.transform =
        `rotate(${degrees}deg)`;
}


function updateAccelerationDisplay() {

    if (
        state.accelerationG >
        0.05
    ) {

        $("#speedState").textContent =
            "ACCELERATING";

    } else if (
        state.accelerationG <
        -0.05
    ) {

        $("#speedState").textContent =
            "DECELERATING";

    } else if (
        state.speed > 2
    ) {

        $("#speedState").textContent =
            "CRUISING";

    } else {

        $("#speedState").textContent =
            "STATIONARY";
    }
}


function getSpeedState() {

    if (
        state.accelerationG >
        .05
    ) {

        return "ACCELERATING";
    }

    if (
        state.accelerationG <
        -.05
    ) {

        return "BRAKING";
    }

    if (
        state.speed >
        2
    ) {

        return "CRUISING";
    }

    return "STATIONARY";
}


/* =========================================================
   SPEED WARNING
========================================================= */

function updateWarning() {

    const speed =
        state.speed;

    const warning =
        Number(
            data.settings.warningSpeed
        );

    const critical =
        Number(
            data.settings.criticalSpeed
        );

    document.body
        .classList
        .remove(
            "warning-mode",
            "critical-mode"
        );

    if (
        speed >= critical
    ) {

        document.body
            .classList
            .add(
                "critical-mode"
            );

        warningAlert(
            "CRITICAL SPEED"
        );

    } else if (
        speed >= warning
    ) {

        document.body
            .classList
            .add(
                "warning-mode"
            );

        warningAlert(
            "SPEED WARNING"
        );
    }
}


function warningAlert(
    message
) {

    const now =
        Date.now();

    if (
        now -
        state.lastWarningTime <
        5000
    ) {

        return;
    }

    state.lastWarningTime =
        now;

    notify(
        message,
        "!"
    );

    playBeep();

    vibrate(
        [100, 60, 100]
    );
}


/* =========================================================
   ACCELERATION TESTS
========================================================= */

function updatePerformanceTests() {

    const speed =
        state.speed;

    if (
        speed < 2
    ) {

        return;
    }

    const elapsed =
        state.rideStartTime
            ? (
                Date.now() -
                state.rideStartTime
            ) / 1000
            : 0;

    [
        30,
        60,
        80,
        100
    ].forEach(target => {

        if (
            !state.tests[target] &&
            speed >= target
        ) {

            state.tests[target] =
                elapsed;

            notify(
                `0–${target} test complete`
            );

            vibrate(
                [80]
            );
        }
    });
}


function resetTests() {

    state.tests = {

        30: null,

        60: null,

        80: null,

        100: null
    };

    state.raceTimes = {

        30: null,

        60: null,

        80: null,

        100: null
    };

    updateTestsUI();
}


function updateTestsUI() {

    $("#time30").textContent =
        formatTest(
            state.tests[30]
        );

    $("#time60").textContent =
        formatTest(
            state.tests[60]
        );

    $("#time80").textContent =
        formatTest(
            state.tests[80]
        );

    $("#time100").textContent =
        formatTest(
            state.tests[100]
        );

    $("#race30").textContent =
        formatTest(
            state.raceTimes[30]
        );

    $("#race60").textContent =
        formatTest(
            state.raceTimes[60]
        );

    $("#race80").textContent =
        formatTest(
            state.raceTimes[80]
        );

    $("#race100").textContent =
        formatTest(
            state.raceTimes[100]
        );
}


function formatTest(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "--";
    }

    return value.toFixed(2) +
        " s";
}


/* =========================================================
   RACE MODE
========================================================= */

function startRace() {

    if (
        state.raceRunning
    ) {

        return;
    }

    state.raceRunning =
        true;

    state.raceDistance =
        0;

    state.raceMaxSpeed =
        0;

    state.raceTimes = {

        30: null,

        60: null,

        80: null,

        100: null
    };

    $("#raceCountdown").textContent =
        "3";

    let count = 3;

    const timer =
        setInterval(() => {

            count--;

            if (
                count > 0
            ) {

                $("#raceCountdown")
                    .textContent =
                    count;

                playBeep();

            } else {

                clearInterval(timer);

                $("#raceCountdown")
                    .textContent =
                    "GO!";

                state.raceStartTime =
                    Date.now();

                playBeep();

                vibrate(
                    [150, 100, 150]
                );
            }

        }, 1000);
}


function updateRace() {

    if (
        !state.raceRunning ||
        !state.raceStartTime
    ) {

        return;
    }

    const elapsed =
        (
            Date.now() -
            state.raceStartTime
        ) / 1000;

    state.raceMaxSpeed =
        Math.max(
            state.raceMaxSpeed,
            state.speed
        );

    [
        30,
        60,
        80,
        100
    ].forEach(target => {

        if (
            !state.raceTimes[target] &&
            state.speed >= target
        ) {

            state.raceTimes[target] =
                elapsed;

            notify(
                `Race: ${target} km/h`
            );
        }
    });

    if (
        state.speed >= 100
    ) {

        finishRace();
    }
}


function finishRace() {

    if (
        !state.raceRunning
    ) {

        return;
    }

    state.raceRunning =
        false;

    $("#raceCountdown").textContent =
        "FINISHED";

    playBeep();

    vibrate(
        [150, 80, 150]
    );

    notify(
        "Race run complete"
    );
}


/* =========================================================
   GRAPH
========================================================= */

function setupGraphButtons() {

    $$(".graph-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    $$(".graph-btn")
                        .forEach(btn =>
                            btn.classList
                                .remove("active")
                        );

                    button.classList
                        .add("active");

                    state.currentGraph =
                        button.dataset.graph;

                    drawGraph();
                }
            );

        });
}


function recordTelemetry(
    lat,
    lon,
    altitude,
    accuracy,
    heading,
    speed
) {

    state.telemetry.push({

        time:
            Date.now(),

        lat,

        lon,

        altitude,

        accuracy,

        heading,

        speed,

        acceleration:
            state.accelerationG
    });

    if (
        state.telemetry.length >
        2000
    ) {

        state.telemetry.shift();
    }

    state.speedHistory.push(
        speed
    );

    state.accelHistory.push(
        state.accelerationG
    );

    state.altitudeHistory.push(
        altitude || 0
    );

    if (
        state.speedHistory.length >
        120
    ) {

        state.speedHistory.shift();

        state.accelHistory.shift();

        state.altitudeHistory.shift();
    }

    updateRace();
}


function drawGraph() {

    const canvas =
        $("#telemetryCanvas");

    if (!canvas) return;

    const rect =
        canvas.getBoundingClientRect();

    const dpr =
        window.devicePixelRatio || 1;

    canvas.width =
        rect.width * dpr;

    canvas.height =
        rect.height * dpr;

    const ctx =
        canvas.getContext("2d");

    ctx.scale(
        dpr,
        dpr
    );

    const width =
        rect.width;

    const height =
        rect.height;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    /* grid */

    ctx.strokeStyle =
        "rgba(0,168,255,.08)";

    ctx.lineWidth = 1;

    for (
        let x = 0;
        x < width;
        x += 50
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            height
        );

        ctx.stroke();
    }

    for (
        let y = 20;
        y < height;
        y += 40
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();
    }

    let values;

    if (
        state.currentGraph ===
        "accel"
    ) {

        values =
            state.accelHistory;

    } else if (
        state.currentGraph ===
        "altitude"
    ) {

        values =
            state.altitudeHistory;

    } else {

        values =
            state.speedHistory;
    }

    if (
        values.length < 2
    ) {

        ctx.fillStyle =
            "rgba(150,180,220,.45)";

        ctx.font =
            "10px system-ui";

        ctx.fillText(
            "WAITING FOR TELEMETRY...",
            20,
            height / 2
        );

        return;
    }

    let min =
        Math.min(...values);

    let max =
        Math.max(...values);

    if (
        min === max
    ) {

        max =
            min + 1;
    }

    const padding =
        15;

    ctx.beginPath();

    values.forEach(
        (value, index) => {

            const x =
                padding +
                (
                    index /
                    (values.length - 1)
                ) *
                (
                    width -
                    padding * 2
                );

            const y =
                height -
                padding -
                (
                    (
                        value -
                        min
                    ) /
                    (
                        max -
                        min
                    )
                ) *
                (
                    height -
                    padding * 2
                );

            if (
                index === 0
            ) {

                ctx.moveTo(
                    x,
                    y
                );

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }
    );

    ctx.strokeStyle =
        "#00a8ff";

    ctx.lineWidth = 2.5;

    ctx.shadowBlur = 12;

    ctx.shadowColor =
        "#0066ff";

    ctx.stroke();

    ctx.shadowBlur = 0;

    /* label */

    ctx.fillStyle =
        "#7dd3ff";

    ctx.font =
        "bold 9px system-ui";

    ctx.fillText(
        state.currentGraph
            .toUpperCase(),
        18,
        18
    );
}


/* =========================================================
   MAP
========================================================= */

function initializeMap() {

    if (
        typeof L === "undefined"
    ) {

        console.warn(
            "Leaflet not loaded"
        );

        return;
    }

    state.map =
        L.map(
            "map",
            {
                zoomControl: true
            }
        ).setView(
            [
                14.58,
                121.12
            ],
            13
        );

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap"
        }
    ).addTo(
        state.map
    );

    state.mapReady =
        true;
}


function updateMapPosition(
    lat,
    lon
) {

    if (
        !state.mapReady
    ) {

        return;
    }

    const position =
        [lat, lon];

    if (
        !state.marker
    ) {

        state.marker =
            L.circleMarker(
                position,
                {
                    radius: 8,

                    color:
                        "#00a8ff",

                    fillColor:
                        "#0066ff",

                    fillOpacity: .95,

                    weight: 2
                }
            ).addTo(
                state.map
            );

        state.marker.bindPopup(
            "NITRON RACING"
        );

        state.startMarker =
            L.circleMarker(
                position,
                {
                    radius: 5,

                    color:
                        "#635bff",

                    fillColor:
                        "#635bff",

                    fillOpacity: .9
                }
            ).addTo(
                state.map
            );

    } else {

        state.marker
            .setLatLng(
                position
            );
    }

    if (
        data.settings.autoCenter
    ) {

        state.map.panTo(
            position,
            {
                animate: true,
                duration: .4
            }
        );
    }
}


function drawRoute() {

    if (
        !state.mapReady ||
        state.route.length < 2
    ) {

        return;
    }

    const points =
        state.route.map(
            point =>
                [
                    point.lat,
                    point.lon
                ]
        );

    if (
        !state.routeLine
    ) {

        state.routeLine =
            L.polyline(
                points,
                {
                    color:
                        "#00a8ff",

                    weight: 4,

                    opacity: .85
                }
            ).addTo(
                state.map
            );

    } else {

        state.routeLine
            .setLatLngs(
                points
            );
    }
}


function clearMapRoute() {

    if (
        !state.mapReady
    ) {

        return;
    }

    if (
        state.routeLine
    ) {

        state.map.removeLayer(
            state.routeLine
        );

        state.routeLine =
            null;
    }

    if (
        state.startMarker
    ) {

        state.map.removeLayer(
            state.startMarker
        );

        state.startMarker =
            null;
    }
}


function centerMap() {

    if (
        !state.map ||
        !state.marker
    ) {

        notify(
            "No GPS position yet",
            "!"
        );

        return;
    }

    state.map.setView(
        state.marker.getLatLng(),
        16
    );
}


function clearRoute() {

    if (
        !confirm(
            "Clear current route?"
        )
    ) {

        return;
    }

    state.route = [];

    clearMapRoute();

    notify(
        "Route cleared"
    );
}


/* =========================================================
   WAYPOINT
========================================================= */

function markWaypoint() {

    if (
        !state.lastPosition
    ) {

        notify(
            "Waiting for GPS",
            "!"
        );

        return;
    }

    const name =
        prompt(
            "Waypoint name:",
            "Waypoint " +
            (state.waypoints.length + 1)
        );

    if (
        name === null
    ) {

        return;
    }

    const waypoint = {

        id: Date.now(),

        name:
            name.trim() ||
            "Waypoint",

        lat:
            state.lastPosition.lat,

        lon:
            state.lastPosition.lon,

        time:
            new Date().toISOString()
    };

    state.waypoints.push(
        waypoint
    );

    if (
        state.mapReady
    ) {

        L.marker(
            [
                waypoint.lat,
                waypoint.lon
            ]
        )
            .addTo(
                state.map
            )
            .bindPopup(
                waypoint.name
            );
    }

    notify(
        "Waypoint saved"
    );

    vibrate(
        [80]
    );
}


/* =========================================================
   HISTORY
========================================================= */

function renderHistory() {

    const list =
        $("#historyList");

    if (
        !data.rides.length
    ) {

        list.innerHTML = `
            <div class="history-card">
                <div>
                    <h3>No rides recorded</h3>
                    <div class="date">
                        Start your first ride to create telemetry history.
                    </div>
                </div>
            </div>
        `;

        return;
    }

    list.innerHTML =
        data.rides.map(
            ride => {

                const date =
                    new Date(
                        ride.date
                    );

                return `
                    <div class="history-card">

                        <div>

                            <h3>
                                RIDE #${ride.id
                                    .toString()
                                    .slice(-5)}
                            </h3>

                            <div class="date">
                                ${date.toLocaleString()}
                            </div>

                            <div class="history-stats">

                                <div>
                                    <span>DISTANCE</span>
                                    <strong>
                                        ${ride.distance.toFixed(2)} km
                                    </strong>
                                </div>

                                <div>
                                    <span>MAX</span>
                                    <strong>
                                        ${formatDisplaySpeed(
                                            ride.maxSpeed
                                        )} ${getUnit()}
                                    </strong>
                                </div>

                                <div>
                                    <span>AVG</span>
                                    <strong>
                                        ${formatDisplaySpeed(
                                            ride.averageSpeed
                                        )} ${getUnit()}
                                    </strong>
                                </div>

                                <div>
                                    <span>TIME</span>
                                    <strong>
                                        ${formatTime(
                                            ride.duration
                                        )}
                                    </strong>
                                </div>

                            </div>

                        </div>

                        <div class="history-buttons">

                            <button
                                onclick="replayRide(${ride.id})">
                                REPLAY
                            </button>

                            <button
                                onclick="exportRide(${ride.id}, 'csv')">
                                CSV
                            </button>

                            <button
                                onclick="exportRide(${ride.id}, 'gpx')">
                                GPX
                            </button>

                            <button
                                onclick="deleteRide(${ride.id})">
                                DELETE
                            </button>

                        </div>

                    </div>
                `;
            }
        ).join("");
}


function deleteRide(id) {

    if (
        !confirm(
            "Delete this ride?"
        )
    ) {

        return;
    }

    data.rides =
        data.rides.filter(
            ride =>
                ride.id !== id
        );

    recalculateRecords();

    saveData();

    renderHistory();

    updateRecords();

    notify(
        "Ride deleted"
    );
}


function clearHistory() {

    if (
        !data.rides.length
    ) {

        return;
    }

    if (
        !confirm(
            "Delete ALL ride history?"
        )
    ) {

        return;
    }

    data.rides = [];

    data.records =
        structuredClone(
            defaultData.records
        );

    saveData();

    renderHistory();

    updateRecords();

    notify(
        "Ride history cleared"
    );
}


/* =========================================================
   RECORDS
========================================================= */

function updateRecordsFromRide(
    ride
) {

    data.records.topSpeed =
        Math.max(
            data.records.topSpeed,
            ride.maxSpeed
        );

    if (
        ride.tests[60] !== null &&
        (
            data.records.best60 === null ||
            ride.tests[60] <
            data.records.best60
        )
    ) {

        data.records.best60 =
            ride.tests[60];
    }

    if (
        ride.tests[100] !== null &&
        (
            data.records.best100 === null ||
            ride.tests[100] <
            data.records.best100
        )
    ) {

        data.records.best100 =
            ride.tests[100];
    }

    data.records.totalDistance +=
        ride.distance;
}


function recalculateRecords() {

    data.records =
        structuredClone(
            defaultData.records
        );

    data.rides.forEach(
        updateRecordsFromRide
    );
}


function updateRecords() {

    $("#recordTopSpeed").textContent =
        Math.round(
            convertSpeed(
                data.records.topSpeed
            )
        );

    $("#record60").textContent =
        data.records.best60 !== null
            ? data.records.best60.toFixed(2)
            : "--";

    $("#record100").textContent =
        data.records.best100 !== null
            ? data.records.best100.toFixed(2)
            : "--";

    $("#recordDistance").textContent =
        data.records.totalDistance
            .toFixed(1);
}


/* =========================================================
   RIDE REPLAY
========================================================= */

function replayRide(id) {

    const ride =
        data.rides.find(
            item =>
                item.id === id
        );

    if (
        !ride
    ) {

        return;
    }

    if (
        !ride.route ||
        ride.route.length < 2
    ) {

        notify(
            "This ride has no route data",
            "!"
        );

        return;
    }

    const mapButton =
        document.querySelector(
            '[data-page="map"]'
        );

    if (mapButton) {

        mapButton.click();
    }

    setTimeout(() => {

        clearMapRoute();

        const points =
            ride.route.map(
                p =>
                    [
                        p.lat,
                        p.lon
                    ]
            );

        state.routeLine =
            L.polyline(
                points,
                {
                    color:
                        "#635bff",

                    weight: 5,

                    opacity: .9
                }
            ).addTo(
                state.map
            );

        state.map.fitBounds(
            state.routeLine.getBounds(),
            {
                padding: [30, 30]
            }
        );

        let index = 0;

        const replayMarker =
            L.circleMarker(
                points[0],
                {
                    radius: 8,

                    color:
                        "#00a8ff",

                    fillColor:
                        "#0066ff",

                    fillOpacity: 1
                }
            ).addTo(
                state.map
            );

        const interval =
            setInterval(() => {

                if (
                    index >=
                    points.length - 1
                ) {

                    clearInterval(
                        interval
                    );

                    state.map.removeLayer(
                        replayMarker
                    );

                    notify(
                        "Replay finished"
                    );

                    return;
                }

                index++;

                replayMarker
                    .setLatLng(
                        points[index]
                    );

            }, 100);

        notify(
            "Ride replay started"
        );

    }, 250);
}


/* =========================================================
   EXPORT
========================================================= */

function exportRide(
    id,
    format
) {

    const ride =
        data.rides.find(
            item =>
                item.id === id
        );

    if (
        !ride
    ) {

        return;
    }

    if (
        format === "gpx"
    ) {

        exportGPX(
            ride
        );

    } else {

        exportCSV(
            ride
        );
    }
}


function exportAllRides() {

    if (
        !data.rides.length
    ) {

        notify(
            "No rides to export",
            "!"
        );

        return;
    }

    downloadFile(
        "nitron-rides.json",
        JSON.stringify(
            data.rides,
            null,
            2
        ),
        "application/json"
    );

    notify(
        "Ride data exported"
    );
}


function exportCSV(
    ride
) {

    const rows = [

        [
            "time",
            "latitude",
            "longitude",
            "speed_kmh",
            "altitude",
            "accuracy",
            "heading",
            "acceleration_g"
        ]

    ];

    (
        ride.route || []
    ).forEach(
        point => {

            rows.push([

                new Date(
                    point.time
                ).toISOString(),

                point.lat,

                point.lon,

                point.speed,

                point.altitude ?? "",

                point.accuracy ?? "",

                "",

                ""
            ]);
        }
    );

    const csv =
        rows
            .map(
                row =>
                    row
                        .map(
                            value =>
                                `"${String(value)
                                    .replaceAll(
                                        '"',
                                        '""'
                                    )}"`
                        )
                        .join(",")
            )
            .join("\n");

    downloadFile(
        `nitron-ride-${ride.id}.csv`,
        csv,
        "text/csv"
    );

    notify(
        "CSV exported"
    );
}


function exportGPX(
    ride
) {

    const points =
        ride.route || [];

    const track =
        points.map(
            point => {

                return `
                    <trkpt
                        lat="${point.lat}"
                        lon="${point.lon}">
                        ${
                            Number.isFinite(
                                point.altitude
                            )
                                ? `<ele>${point.altitude}</ele>`
                                : ""
                        }
                        <time>
                            ${new Date(
                                point.time
                            ).toISOString()}
                        </time>
                    </trkpt>
                `;
            }
        ).join("");

    const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Nitron Racing"
     xmlns="http://www.topografix.com/GPX/1/1">

<trk>
    <name>Nitron Racing Ride</name>
    <trkseg>
        ${track}
    </trkseg>
</trk>

</gpx>`;

    downloadFile(
        `nitron-ride-${ride.id}.gpx`,
        gpx,
        "application/gpx+xml"
    );

    notify(
        "GPX exported"
    );
}


function exportBackup() {

    downloadFile(
        "nitron-racing-backup.json",
        JSON.stringify(
            data,
            null,
            2
        ),
        "application/json"
    );

    notify(
        "Backup exported"
    );
}


function importBackup() {

    const input =
        document.createElement(
            "input"
        );

    input.type =
        "file";

    input.accept =
        ".json,application/json";

    input.onchange =
        event => {

            const file =
                event.target.files[0];

            if (!file) return;

            const reader =
                new FileReader();

            reader.onload =
                () => {

                    try {

                        const imported =
                            JSON.parse(
                                reader.result
                            );

                        if (
                            !imported.settings ||
                            !Array.isArray(
                                imported.rides
                            )
                        ) {

                            throw new Error(
                                "Invalid backup"
                            );
                        }

                        data =
                            imported;

                        saveData();

                        location.reload();

                    } catch (error) {

                        alert(
                            "Invalid Nitron backup file."
                        );
                    }
                };

            reader.readAsText(
                file
            );
        };

    input.click();
}


function downloadFile(
    filename,
    content,
    type
) {

    const blob =
        new Blob(
            [content],
            {
                type
            }
        );

    const url =
        URL.createObjectURL(
            blob
        );

    const link =
        document.createElement(
            "a"
        );

    link.href =
        url;

    link.download =
        filename;

    document.body.appendChild(
        link
    );

    link.click();

    link.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(
                url
            ),
        1000
    );
}


/* =========================================================
   GARAGE
========================================================= */

function renderGarage() {

    const list =
        $("#vehicleList");

    list.innerHTML =
        data.vehicles.map(
            vehicle => `

                <div class="
                    vehicle-card
                    ${
                        vehicle.active
                            ? "active-vehicle"
                            : ""
                    }
                ">

                    <div>

                        <h3>
                            🏍 ${escapeHTML(
                                vehicle.name
                            )}
                        </h3>

                        <p>
                            ${escapeHTML(
                                vehicle.model
                            )}
                            ·
                            ${escapeHTML(
                                vehicle.engine
                            )}
                        </p>

                        <p>
                            ODOMETER:
                            ${Number(
                                vehicle.odometer || 0
                            ).toLocaleString()}
                            KM
                        </p>

                    </div>

                    <div class="vehicle-actions">

                        ${
                            !vehicle.active
                                ? `
                                    <button
                                        class="small-btn"
                                        onclick="
                                            activateVehicle(
                                                ${vehicle.id}
                                            )
                                        ">
                                        SELECT
                                    </button>
                                `
                                : `
                                    <span class="quality-badge">
                                        ACTIVE
                                    </span>
                                `
                        }

                        <button
                            class="small-btn"
                            onclick="
                                deleteVehicle(
                                    ${vehicle.id}
                                )
                            ">
                            ×
                        </button>

                    </div>

                </div>
            `
        ).join("");
}


function addVehicle() {

    const name =
        prompt(
            "Motorcycle name:",
            "My Motorcycle"
        );

    if (
        !name
    ) return;

    const model =
        prompt(
            "Model:",
            "Motorcycle"
        ) ||
        "";

    const engine =
        prompt(
            "Engine:",
            "150 cc"
        ) ||
        "";

    const vehicle = {

        id: Date.now(),

        name,

        model,

        engine,

        odometer: 0,

        active:
            data.vehicles.length === 0
    };

    data.vehicles.push(
        vehicle
    );

    saveData();

    renderGarage();

    notify(
        "Motorcycle added"
    );
}


function activateVehicle(id) {

    data.vehicles
        .forEach(
            vehicle => {

                vehicle.active =
                    vehicle.id === id;
            }
        );

    saveData();

    renderGarage();

    notify(
        "Motorcycle selected"
    );
}


function deleteVehicle(id) {

    if (
        data.vehicles.length <= 1
    ) {

        notify(
            "Keep at least one motorcycle",
            "!"
        );

        return;
    }

    if (
        !confirm(
            "Delete motorcycle?"
        )
    ) {

        return;
    }

    data.vehicles =
        data.vehicles.filter(
            vehicle =>
                vehicle.id !== id
        );

    if (
        !data.vehicles.some(
            vehicle =>
                vehicle.active
        )
    ) {

        data.vehicles[0].active =
            true;
    }

    saveData();

    renderGarage();

    notify(
        "Motorcycle removed"
    );
}


/* =========================================================
   MAINTENANCE
========================================================= */

function renderMaintenance() {

    const list =
        $("#maintenanceList");

    if (
        !data.maintenance.length
    ) {

        list.innerHTML = `
            <div class="maintenance-card">
                <div>
                    <strong>
                        No maintenance records
                    </strong>
                    <span>
                        Add your first service item.
                    </span>
                </div>
            </div>
        `;

        return;
    }

    list.innerHTML =
        data.maintenance.map(
            item => `

                <div class="maintenance-card">

                    <div>

                        <strong>
                            ${escapeHTML(
                                item.name
                            )}
                        </strong>

                        <span>
                            ${escapeHTML(
                                item.date
                            )}
                            ·
                            ${escapeHTML(
                                item.notes
                            )}
                        </span>

                    </div>

                    <button
                        class="small-btn"
                        onclick="
                            deleteMaintenance(
                                ${item.id}
                            )
                        ">
                        DELETE
                    </button>

                </div>
            `
        ).join("");
}


function addMaintenance() {

    const name =
        prompt(
            "Maintenance item:",
            "Engine Oil"
        );

    if (
        !name
    ) return;

    const date =
        prompt(
            "Date:",
            new Date()
                .toISOString()
                .slice(0, 10)
        ) ||
        "";

    const notes =
        prompt(
            "Notes:",
            "Service completed"
        ) ||
        "";

    data.maintenance.push({

        id: Date.now(),

        name,

        date,

        notes
    });

    saveData();

    renderMaintenance();

    notify(
        "Maintenance saved"
    );
}


function deleteMaintenance(id) {

    data.maintenance =
        data.maintenance.filter(
            item =>
                item.id !== id
        );

    saveData();

    renderMaintenance();
}


/* =========================================================
   EXPENSES
========================================================= */

function renderExpenses() {

    const list =
        $("#expenseList");

    if (
        !data.expenses.length
    ) {

        list.innerHTML = `
            <div class="expense-card">
                <div>
                    <strong>
                        No expenses recorded
                    </strong>
                    <span>
                        Add fuel, parts or maintenance costs.
                    </span>
                </div>
            </div>
        `;

    } else {

        list.innerHTML =
            data.expenses.map(
                item => `

                    <div class="expense-card">

                        <div>

                            <strong>
                                ${escapeHTML(
                                    item.name
                                )}
                            </strong>

                            <span>
                                ${escapeHTML(
                                    item.date
                                )}
                            </span>

                        </div>

                        <div>

                            <strong>
                                ₱${Number(
                                    item.amount
                                ).toFixed(2)}
                            </strong>

                            <button
                                class="small-btn"
                                onclick="
                                    deleteExpense(
                                        ${item.id}
                                    )
                                ">
                                ×
                            </button>

                        </div>

                    </div>
                `
            ).join("");
    }

    const total =
        data.expenses.reduce(
            (
                sum,
                item
            ) =>
                sum +
                Number(
                    item.amount
                ),
            0
        );

    $("#expenseTotal")
        .textContent =
        "₱" +
        total.toLocaleString(
            undefined,
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
}


function addExpense() {

    const name =
        prompt(
            "Expense:",
            "Fuel"
        );

    if (
        !name
    ) return;

    const amount =
        Number(
            prompt(
                "Amount:",
                "500"
            )
        );

    if (
        !Number.isFinite(amount)
    ) {

        return;
    }

    data.expenses.push({

        id: Date.now(),

        name,

        amount,

        date:
            new Date()
                .toISOString()
                .slice(0, 10)
    });

    saveData();

    renderExpenses();

    notify(
        "Expense added"
    );
}


function deleteExpense(id) {

    data.expenses =
        data.expenses.filter(
            item =>
                item.id !== id
        );

    saveData();

    renderExpenses();
}


/* =========================================================
   EMERGENCY LOCATION
========================================================= */

function openEmergency() {

    openModal(
        "emergencyModal"
    );

    $("#emergencyLat").textContent =
        state.lastPosition
            ? state.lastPosition.lat
                .toFixed(6)
            : "--";

    $("#emergencyLon").textContent =
        state.lastPosition
            ? state.lastPosition.lon
                .toFixed(6)
            : "--";
}


async function copyLocation() {

    if (
        !state.lastPosition
    ) {

        notify(
            "No GPS location available",
            "!"
        );

        return;
    }

    const text =
        `${state.lastPosition.lat.toFixed(6)}, ` +
        `${state.lastPosition.lon.toFixed(6)}`;

    try {

        await navigator.clipboard.writeText(
            text
        );

        notify(
            "Coordinates copied"
        );

    } catch {

        prompt(
            "Copy coordinates:",
            text
        );
    }
}


function openLocation() {

    if (
        !state.lastPosition
    ) {

        notify(
            "No GPS location available",
            "!"
        );

        return;
    }

    const url =
        `https://www.google.com/maps?q=` +
        `${state.lastPosition.lat},` +
        `${state.lastPosition.lon}`;

    window.open(
        url,
        "_blank"
    );
}


/* =========================================================
   WAKE LOCK
========================================================= */

async function toggleWakeLock() {

    if (
        !("wakeLock" in navigator)
    ) {

        notify(
            "Wake Lock not supported",
            "!"
        );

        return;
    }

    try {

        if (
            state.wakeLock
        ) {

            await state.wakeLock.release();

            state.wakeLock =
                null;

            $("#wakeLockBtn")
                .textContent =
                "☀ KEEP SCREEN ON";

            $("#systemWake")
                .textContent =
                "OFF";

            notify(
                "Screen wake lock disabled"
            );

        } else {

            state.wakeLock =
                await navigator
                    .wakeLock
                    .request(
                        "screen"
                    );

            $("#wakeLockBtn")
                .textContent =
                "☀ SCREEN LOCKED";

            $("#systemWake")
                .textContent =
                "ON";

            notify(
                "Screen will stay awake"
            );
        }

    } catch (error) {

        console.warn(
            "Wake lock:",
            error
        );

        notify(
            "Wake lock unavailable",
            "!"
        );
    }
}


document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.visibilityState ===
            "visible" &&
            state.wakeLock
        ) {

            try {

                state.wakeLock =
                    await navigator
                        .wakeLock
                        .request(
                            "screen"
                        );

            } catch {}
        }
    }
);


/* =========================================================
   FULLSCREEN
========================================================= */

async function toggleFullscreen() {

    try {

        if (
            !document.fullscreenElement
        ) {

            await document
                .documentElement
                .requestFullscreen();

        } else {

            await document
                .exitFullscreen();
        }

    } catch (error) {

        console.warn(
            "Fullscreen:",
            error
        );
    }
}


/* =========================================================
   SOUND
========================================================= */

function enableSound() {

    try {

        if (
            !state.audioContext
        ) {

            state.audioContext =
                new (
                    window.AudioContext ||
                    window.webkitAudioContext
                )();
        }

        if (
            state.audioContext.state ===
            "suspended"
        ) {

            state.audioContext.resume();
        }

        playBeep();

        $("#soundBtn")
            .textContent =
            "🔊 SOUND ON";

        $("#systemAudio")
            .textContent =
            "ON";

        notify(
            "Sound enabled"
        );

    } catch (error) {

        notify(
            "Audio unavailable",
            "!"
        );
    }
}


function playBeep(
    frequency = 700,
    duration = .08
) {

    if (
        !state.audioContext
    ) {

        return;
    }

    try {

        const oscillator =
            state.audioContext
                .createOscillator();

        const gain =
            state.audioContext
                .createGain();

        oscillator.type =
            "sine";

        oscillator.frequency.value =
            frequency;

        gain.gain.setValueAtTime(
            .001,
            state.audioContext
                .currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
            .12,
            state.audioContext
                .currentTime + .01
        );

        gain.gain.exponentialRampToValueAtTime(
            .001,
            state.audioContext
                .currentTime + duration
        );

        oscillator.connect(
            gain
        );

        gain.connect(
            state.audioContext.destination
        );

        oscillator.start();

        oscillator.stop(
            state.audioContext
                .currentTime +
            duration
        );

    } catch {}
}


/* =========================================================
   VIBRATION
========================================================= */

function vibrate(pattern) {

    if (
        !data.settings.vibration
    ) {

        return;
    }

    if (
        navigator.vibrate
    ) {

        navigator.vibrate(
            pattern
        );
    }
}


/* =========================================================
   DEMO MODE
========================================================= */

function toggleDemoMode() {

    state.demoMode =
        !state.demoMode;

    if (
        state.demoMode
    ) {

        startDemo();

        $("#demoBtn")
            .textContent =
            "■ DEMO ON";

        $("#systemMode")
            .textContent =
            "DEMO";

        notify(
            "Demo telemetry enabled"
        );

    } else {

        stopDemo();

        $("#demoBtn")
            .textContent =
            "◉ DEMO";

        $("#systemMode")
            .textContent =
            "GPS";

        notify(
            "Demo telemetry disabled"
        );
    }
}


function startDemo() {

    let t = 0;

    state.demoTimer =
        setInterval(
            () => {

                t += .15;

                const simulatedSpeed =
                    Math.max(
                        0,
                        Math.min(
                            150,
                            75 +
                            Math.sin(t) *
                            55
                        )
                    );

                const fakeLat =
                    14.58 +
                    Math.sin(t / 5) *
                    .005;

                const fakeLon =
                    121.12 +
                    Math.cos(t / 5) *
                    .005;

                updateTelemetry(
                    fakeLat,
                    fakeLon,
                    20 +
                    Math.sin(t) * 10,
                    5,
                    (
                        t * 25
                    ) % 360,
                    simulatedSpeed
                );

                state.lastPosition = {

                    lat: fakeLat,

                    lon: fakeLon,

                    time: Date.now()
                };

                if (
                    state.rideRunning &&
                    !state.ridePaused
                ) {

                    const distance =
                        simulatedSpeed /
                        3600 *
                        .15;

                    state.distanceKm +=
                        distance;

                    state.route.push({

                        lat: fakeLat,

                        lon: fakeLon,

                        time: Date.now(),

                        speed:
                            simulatedSpeed,

                        altitude:
                            20,

                        accuracy:
                            5
                    });

                    drawRoute();
                }

                updateUI();

            },
            150
        );
}


function stopDemo() {

    if (
        state.demoTimer
    ) {

        clearInterval(
            state.demoTimer
        );

        state.demoTimer =
            null;
    }
}


/* =========================================================
   MODALS
========================================================= */

function setupModals() {

    $$(".modal")
        .forEach(modal => {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        closeModal(
                            modal.id
                        );
                    }
                }
            );
        });
}


function openModal(id) {

    const modal =
        $("#" + id);

    if (modal) {

        modal.classList
            .remove("hidden");
    }
}


function closeModal(id) {

    const modal =
        $("#" + id);

    if (modal) {

        modal.classList
            .add("hidden");
    }
}


/* =========================================================
   NOTIFICATIONS
========================================================= */

let notificationTimer = null;


function notify(
    message,
    icon = "✓"
) {

    const notification =
        $("#notification");

    $("#notificationText")
        .textContent =
        message;

    $("#notificationIcon")
        .textContent =
        icon;

    notification.classList
        .add("show");

    clearTimeout(
        notificationTimer
    );

    notificationTimer =
        setTimeout(
            () => {

                notification.classList
                    .remove("show");

            },
            2800
        );
}


/* =========================================================
   SPEEDOMETER TICKS
========================================================= */

function createSpeedometerTicks() {

    const container =
        $(".speed-ticks");

    if (!container) return;

    container.innerHTML =
        "";

    for (
        let i = 0;
        i < 49;
        i++
    ) {

        const tick =
            document.createElement(
                "span"
            );

        tick.style.position =
            "absolute";

        tick.style.left =
            "50%";

        tick.style.top =
            "0";

        tick.style.width =
            i % 4 === 0
                ? "2px"
                : "1px";

        tick.style.height =
            i % 4 === 0
                ? "10px"
                : "5px";

        tick.style.background =
            i > 39
                ? "#635bff"
                : "rgba(255,255,255,.65)";

        tick.style.transformOrigin =
            "50% 185px";

        tick.style.transform =
            `translateX(-50%)
             rotate(${
                 -120 +
                 i * 5
             }deg)`;

        container.appendChild(
            tick
        );
    }
}


/* =========================================================
   UTILITY
========================================================= */

function haversineDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R =
        6371;

    const dLat =
        toRadians(
            lat2 - lat1
        );

    const dLon =
        toRadians(
            lon2 - lon1
        );

    const a =
        Math.sin(
            dLat / 2
        ) ** 2 +

        Math.cos(
            toRadians(lat1)
        ) *

        Math.cos(
            toRadians(lat2)
        ) *

        Math.sin(
            dLon / 2
        ) ** 2;

    return (
        R *
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        )
    );
}


function toRadians(
    degrees
) {

    return degrees *
        Math.PI /
        180;
}


function calculateAverageSpeed() {

    if (
        state.movingSeconds <= 0
    ) {

        return 0;
    }

    return (
        state.distanceKm /
        (
            state.movingSeconds /
            3600
        )
    );
}


function convertSpeed(
    kmh
) {

    if (
        data.settings.unit ===
        "mph"
    ) {

        return kmh *
            0.621371;
    }

    return kmh;
}


function formatDisplaySpeed(
    kmh
) {

    return Math.round(
        convertSpeed(kmh)
    );
}


function formatSpeed(
    kmh
) {

    return (
        convertSpeed(kmh)
    ).toFixed(1) +
        " " +
        getUnit();
}


function getUnit() {

    return data.settings.unit ===
        "mph"
        ? "MPH"
        : "KM/H";
}


function formatTime(
    seconds
) {

    seconds =
        Math.max(
            0,
            Math.floor(
                seconds || 0
            )
        );

    const h =
        Math.floor(
            seconds / 3600
        );

    const m =
        Math.floor(
            (
                seconds % 3600
            ) / 60
        );

    const s =
        seconds % 60;

    if (h > 0) {

        return (
            String(h)
                .padStart(2, "0") +
            ":" +
            String(m)
                .padStart(2, "0") +
            ":" +
            String(s)
                .padStart(2, "0")
        );
    }

    return (
        String(m)
            .padStart(2, "0") +
        ":" +
        String(s)
            .padStart(2, "0")
    );
}


function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );
}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   WINDOW EVENTS
========================================================= */

window.addEventListener(
    "resize",
    () => {

        drawGraph();

        if (
            state.map
        ) {

            state.map.invalidateSize();
        }
    }
);


/* =========================================================
   MAIN TELEMETRY LOOP
========================================================= */

setInterval(
    () => {

        updateRace();

        updateUI();

    },
    250
);


/* =========================================================
   EXPORT GLOBAL FUNCTIONS
========================================================= */

window.replayRide =
    replayRide;

window.exportRide =
    exportRide;

window.deleteRide =
    deleteRide;

window.activateVehicle =
    activateVehicle;

window.deleteVehicle =
    deleteVehicle;

window.deleteMaintenance =
    deleteMaintenance;

window.deleteExpense =
    deleteExpense;


/* =========================================================
   SYSTEM STATUS
========================================================= */

function updateSystemStatus() {

    $("#systemWake")
        .textContent =
        "OFF";

    $("#systemAudio")
        .textContent =
        "OFF";

    $("#systemVibration")
        .textContent =
        navigator.vibrate
            ? "READY"
            : "N/A";
}


/* =========================================================
   READY
========================================================= */

console.log(
    "%c NITRON RACING V5 ",
    "background:#0066ff;color:white;font-weight:bold;padding:8px;"
);

console.log(
    "GPS Telemetry System Ready"
);