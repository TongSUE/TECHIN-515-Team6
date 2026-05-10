#pragma once
// Ring buffer + real-time feature engineering for AuraSync ML inference.
// One sample ≈ every 9–10 s (BSEC2 LP callback decimated 3×).
// BUF_SIZE 120 → 20-minute rolling window, matching training data.

#include <math.h>
#include <time.h>

#define BUF_SIZE 120

struct FBReading {
    float gas_ohm;
    float temp_c;
    float humidity;
    float gas_norm;   // (gas_ohm - rolling_max) / rolling_max at push time
};

// Defined in AuraSync.ino (extern here so header is includable once)
extern FBReading fb_ring[BUF_SIZE];
extern int       fb_head;   // next write slot
extern int       fb_count;  // valid entries (0..BUF_SIZE)

// ── Shower window scaler (from Data/processed/scalers.pkl) ──────────────────
// Features: temp_c, humidity_pct, gas_norm, humidity_delta_5m, temp_delta_5m, gas_delta_5m
static const float WIN_SC_MEAN[6]  = {26.156223f, 44.804030f, -0.072005f, 0.007973f, -0.001189f, 0.012094f};
static const float WIN_SC_SCALE[6] = {0.884435f,  4.617669f,   0.193655f, 2.074652f,  0.049235f, 0.132006f};

// ── Ring buffer access (ago=0 → newest, ago=1 → one step back, …) ──────────

static inline const FBReading* fb_at(int ago) {
    int idx = ((fb_head - 1 - ago) % BUF_SIZE + BUF_SIZE) % BUF_SIZE;
    return &fb_ring[idx];
}

static inline float fb_get_gas_norm(int ago) { return fb_at(ago)->gas_norm; }
static inline float fb_get_hum(int ago)      { return fb_at(ago)->humidity; }
static inline float fb_get_temp(int ago)     { return fb_at(ago)->temp_c; }

// ── fb_push: add one sample, compute gas_norm against rolling max ────────────
// gas_ohm is capped at 100 kΩ so BSEC2 heater-warmup spikes don't inflate
// the rolling baseline (warmup can reach several hundred kΩ; real bathroom
// readings are typically 20–80 kΩ).
#define GAS_OHM_CAP 100000.0f

static inline void fb_push(float gas_ohm_raw, float temp_c, float hum) {
    float gas_ohm = (gas_ohm_raw > GAS_OHM_CAP) ? GAS_OHM_CAP : gas_ohm_raw;

    // 1. Find rolling max of capped gas_ohm over current valid entries + new reading
    float rmax = gas_ohm;
    for (int i = 0; i < fb_count; i++) {
        float g = fb_ring[((fb_head - i) % BUF_SIZE + BUF_SIZE) % BUF_SIZE].gas_ohm;
        if (g > rmax) rmax = g;
    }

    // 2. Write new reading (store capped value so rmax stays consistent)
    float gn = (rmax > 0.0f) ? (gas_ohm - rmax) / rmax : 0.0f;
    fb_ring[fb_head] = {gas_ohm, temp_c, hum, gn};
    fb_head = (fb_head + 1) % BUF_SIZE;
    if (fb_count < BUF_SIZE) fb_count++;
}

// ── computeIAQFeatures: 10 features for IAQ MLP ─────────────────────────────
// Feature order (matches training): temp_c, humidity_pct, gas_norm,
//   humidity_delta_5m, temp_delta_5m, gas_delta_5m,
//   humidity_max_10m, gas_min_10m, hour_sin, hour_cos
// Caller must ensure fb_count >= 60 before calling.

static inline void computeIAQFeatures(float f[10]) {
    f[0] = fb_get_temp(0);
    f[1] = fb_get_hum(0);
    f[2] = fb_get_gas_norm(0);

    // Delta features (5-minute ≈ 30 samples back)
    int lag = (fb_count >= 31) ? 30 : (fb_count - 1);
    f[3] = fb_get_hum(0)      - fb_get_hum(lag);       // humidity_delta_5m
    f[4] = fb_get_temp(0)     - fb_get_temp(lag);      // temp_delta_5m
    f[5] = fb_get_gas_norm(0) - fb_get_gas_norm(lag);  // gas_delta_5m

    // Rolling stats (10-minute ≈ 60 samples)
    int win = (fb_count < 60) ? fb_count : 60;
    float hmax = fb_get_hum(0);
    float gmin = fb_get_gas_norm(0);
    for (int i = 1; i < win; i++) {
        float h = fb_get_hum(i);
        float g = fb_get_gas_norm(i);
        if (h > hmax) hmax = h;
        if (g < gmin) gmin = g;
    }
    f[6] = hmax;  // humidity_max_10m
    f[7] = gmin;  // gas_min_10m

    // Time encoding (UTC hour)
    time_t now = time(nullptr);
    struct tm *t = gmtime(&now);
    float h24 = (float)t->tm_hour + t->tm_min / 60.0f;
    f[8] = sinf(2.0f * (float)M_PI * h24 / 24.0f);  // hour_sin
    f[9] = cosf(2.0f * (float)M_PI * h24 / 24.0f);  // hour_cos
}

// ── computeShowerWindow: 30×6 normalized window for Shower CNN ──────────────
// Caller must ensure fb_count >= 30 before calling.

static inline void computeShowerWindow(float win[30][6]) {
    int avail = (fb_count < 30) ? fb_count : 30;
    int lag30 = (fb_count >= 31) ? 30 : (fb_count - 1);

    for (int row = 0; row < 30; row++) {
        int ago = 29 - row;   // row 0 = oldest in window, row 29 = newest

        float raw[6];
        if (ago < avail) {
            const FBReading *r = fb_at(ago);
            // Compute delta features relative to 30 steps before this sample
            int ago30 = ago + lag30;
            float hum_prev = (ago30 < fb_count) ? fb_get_hum(ago30)      : r->humidity;
            float tmp_prev = (ago30 < fb_count) ? fb_get_temp(ago30)     : r->temp_c;
            float gn_prev  = (ago30 < fb_count) ? fb_get_gas_norm(ago30) : r->gas_norm;

            raw[0] = r->temp_c;
            raw[1] = r->humidity;
            raw[2] = r->gas_norm;
            raw[3] = r->humidity - hum_prev;
            raw[4] = r->temp_c   - tmp_prev;
            raw[5] = r->gas_norm - gn_prev;
        } else {
            // Pad with zeros if not enough history
            for (int f = 0; f < 6; f++) raw[f] = 0.0f;
        }

        // Apply StandardScaler
        for (int f = 0; f < 6; f++)
            win[row][f] = (raw[f] - WIN_SC_MEAN[f]) / WIN_SC_SCALE[f];
    }
}
