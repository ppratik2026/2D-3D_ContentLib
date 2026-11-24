"""Royalty-free cartoon background music, synthesized with numpy (no samples, no licences).

Generates a cheerful chiptune loop (bass + chords + melody + light drums) of any
length and writes a 16-bit stereo WAV. Long tracks are written in blocks so a
one-hour track does not need gigabytes of RAM.
"""
import wave

import numpy as np

SR = 44100
# I - V - vi - IV in C major, as MIDI note numbers
PROGRESSION = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
SCALE = [60, 62, 64, 67, 69, 72, 74, 76]


def _freq(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def _tone(f, n, kind="square", vol=0.2):
    t = np.arange(n) / SR
    if kind == "square":
        w = np.sign(np.sin(2 * np.pi * f * t)) * 0.6 + np.sin(2 * np.pi * f * t) * 0.4
    elif kind == "tri":
        w = 2 * np.abs(2 * ((f * t) % 1) - 1) - 1
    else:
        w = np.sin(2 * np.pi * f * t)
    env = np.minimum(1, np.arange(n) / (0.01 * SR)) * np.exp(-3.0 * t / max(t[-1], 1e-3))
    return w * env * vol


def _bar(rng, chord, beat):
    n = beat * 4
    out = np.zeros(n)
    for b in range(4):  # bass on every beat
        out[b * beat:(b + 1) * beat] += _tone(_freq(chord[0] - 12), beat, "tri", 0.28)
    for b in (1, 3):  # off-beat chord stabs
        s = b * beat
        for m in chord:
            out[s:s + beat // 2] += _tone(_freq(m), beat // 2, "square", 0.05)
    half = beat // 2
    for i in range(8):  # melody in eighth notes
        if rng.random() < 0.78:
            m = rng.choice(SCALE + chord) + (12 if rng.random() < 0.25 else 0)
            out[i * half:(i + 1) * half] += _tone(_freq(m), half, "square", 0.09)
    for b in range(4):  # kick + hat
        s = b * beat
        k = min(beat, int(0.12 * SR))
        tt = np.arange(k) / SR
        out[s:s + k] += np.sin(2 * np.pi * (120 - 400 * tt) * tt) * np.exp(-25 * tt) * (0.5 if b % 2 == 0 else 0.2)
        hs = s + half
        hn = int(0.03 * SR)
        out[hs:hs + hn] += rng.standard_normal(hn) * np.exp(-np.arange(hn) / (0.008 * SR)) * 0.06
    return out


def generate(path, seconds, bpm=118, seed=1):
    rng = np.random.default_rng(seed)
    beat = int(SR * 60 / bpm)
    # a 16-bar pattern, looped: keeps the tune recognisable and the render fast
    pattern = np.concatenate([_bar(rng, PROGRESSION[i % 4], beat) for i in range(16)])
    pattern = np.tanh(pattern * 1.2) * 0.8
    total = int(seconds * SR)
    fade = int(min(2.0, seconds / 4) * SR)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        pos = 0
        while pos < total:
            n = min(len(pattern), total - pos)
            block = pattern[:n].copy()
            idx = np.arange(pos, pos + n)
            env = np.minimum(1.0, np.minimum(idx / max(fade, 1), (total - idx) / max(fade, 1)))
            block *= env
            pcm = (np.clip(block, -1, 1) * 32000).astype(np.int16)
            w.writeframes(np.column_stack([pcm, pcm]).tobytes())
            pos += n
    return path
