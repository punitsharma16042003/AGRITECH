// Test script to verify chemical calculations for WQI, SAR, and RSC

// 1. SAR and RSC calculation mock
function calculateIrrigationValues(data) {
    const ca = parseFloat(data.calcium || 0); // mg/L
    const mg = parseFloat(data.magnesium || 0); // mg/L
    const na = parseFloat(data.sodium || 0); // mg/L
    const co3 = parseFloat(data.carbonate || 0); // mg/L
    const hco3 = parseFloat(data.bicarbonate || 0); // mg/L

    // Equivalent weights
    const caMeq = ca / 20.04;
    const mgMeq = mg / 12.16;
    const naMeq = na / 23.00;
    const co3Meq = co3 / 30.00;
    const hco3Meq = hco3 / 61.02;

    let sar = 0;
    const denominator = Math.sqrt((caMeq + mgMeq) / 2);
    if (denominator > 0) {
        sar = naMeq / denominator;
    }

    const rsc = (co3Meq + hco3Meq) - (caMeq + mgMeq);

    return {
        sar: parseFloat(sar.toFixed(2)),
        rsc: parseFloat(rsc.toFixed(2))
    };
}

// 2. WQI calculation mock
function calculateWqi(data) {
    const standards = {
        ph: { s: 8.5, w: 4 },
        ec: { s: 1000, w: 3 },
        tds: { s: 500, w: 4 },
        do: { s: 5.0, w: 5 },
        bod: { s: 5.0, w: 5 },
        cod: { s: 10.0, w: 4 },
        nitrate: { s: 45.0, w: 5 },
        fluoride: { s: 1.5, w: 5 },
        chloride: { s: 250.0, w: 3 },
        sulphate: { s: 250.0, w: 3 },
        e_coli: { s: 1.0, w: 5 }
    };

    let totalWeight = 0;
    Object.keys(standards).forEach(key => {
        const val = parseFloat(data[key]);
        if (!isNaN(val)) {
            totalWeight += standards[key].w;
        }
    });

    if (totalWeight === 0) return { score: 0, rating: 'Undefined' };

    let wqiSum = 0;
    Object.keys(standards).forEach(key => {
        const val = parseFloat(data[key]);
        if (!isNaN(val)) {
            const std = standards[key].s;
            const w = standards[key].w;
            const relativeWeight = w / totalWeight;
            
            let q = 0;
            if (key === 'ph') {
                q = ((val - 7.0) / (std - 7.0)) * 100;
            } else if (key === 'do') {
                q = ((14.6 - val) / (14.6 - std)) * 100;
            } else {
                q = (val / std) * 100;
            }
            
            q = Math.max(0, q);
            wqiSum += relativeWeight * q;
        }
    });

    const score = wqiSum;
    let rating = 'Excellent Water';
    if (score >= 50 && score < 100) rating = 'Good Water';
    if (score >= 100 && score < 200) rating = 'Poor Water';
    if (score >= 200 && score < 300) rating = 'Very Poor Water';
    if (score >= 300) rating = 'Unsuitable for Drinking';

    return {
        score: parseFloat(score.toFixed(1)),
        rating
    };
}

// ==========================================
// RUNNING THE TESTS
// ==========================================

console.log("Running Chemical Calculators Assertion Check...");

// Test Case 1: Irrigation SAR & RSC
const irrigationData = {
    calcium: 40.08,    // 40.08 mg/L / 20.04 = 2.0 meq/L
    magnesium: 24.32,  // 24.32 mg/L / 12.16 = 2.0 meq/L
    sodium: 46.00,     // 46.00 mg/L / 23.00 = 2.0 meq/L
    carbonate: 60.00,  // 60.00 mg/L / 30.00 = 2.0 meq/L
    bicarbonate: 183.06 // 183.06 mg/L / 61.02 = 3.0 meq/L
};

const irriResults = calculateIrrigationValues(irrigationData);
console.log("Irrigation SAR:", irriResults.sar, "(Expected: 1.41)");
console.log("Irrigation RSC:", irriResults.rsc, "(Expected: 1.0)");

// Verify
if (Math.abs(irriResults.sar - 1.41) < 0.05 && Math.abs(irriResults.rsc - 1.0) < 0.05) {
    console.log("✓ Irrigation SAR & RSC calculations PASSED!");
} else {
    console.error("✗ Irrigation calculations FAILED!");
    process.exit(1);
}

// Test Case 2: Water Quality Index (WQI)
const waterData = {
    ph: 7.2,       // close to neutral
    ec: 150,       // low conductivity
    tds: 90,       // low dissolved solids
    do: 8.2,       // high oxygen (good)
    nitrate: 2.0   // low nitrate
};

const wqiResults = calculateWqi(waterData);
console.log("WQI Score:", wqiResults.score);
console.log("WQI Rating:", wqiResults.rating);

// Verify classification
if (wqiResults.score < 50 && wqiResults.rating === "Excellent Water") {
    console.log("✓ WQI calculations PASSED!");
} else {
    console.error("✗ WQI calculations FAILED!");
    process.exit(1);
}

console.log("All calculation verifications completed successfully!");
