import librosa
import numpy as np

def get_beat_timestamps(music_path: str) -> list:
    """
    Detect beat timestamps in a music file.
    Returns list of beat times in seconds.
    """
    try:
        y, sr = librosa.load(music_path, sr=None)
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        return beat_times
    except Exception:
        return []


def snap_cuts_to_beats(clips: list, beat_times: list, tolerance: float = 0.3) -> list:
    """
    Adjust clip cut points to land on the nearest beat.
    tolerance: how many seconds away from a beat is acceptable to snap
    """
    if not beat_times:
        return clips

    def nearest_beat(time: float) -> float:
        if not beat_times:
            return time
        nearest = min(beat_times, key=lambda b: abs(b - time))
        if abs(nearest - time) <= tolerance:
            return round(nearest, 3)
        return time

    snapped = []
    for clip in clips:
        snapped_clip = clip.copy()
        snapped_clip["start_sec"] = nearest_beat(clip["start_sec"])
        snapped_clip["end_sec"] = nearest_beat(clip["end_sec"])

        # Make sure clip still has minimum duration
        if snapped_clip["end_sec"] - snapped_clip["start_sec"] < 0.5:
            snapped_clip["end_sec"] = clip["end_sec"]

        snapped.append(snapped_clip)

    return snapped


def get_energy_map(music_path: str) -> list:
    """
    Analyze music energy over time.
    Returns list of {time, energy} dicts — useful for matching
    clip energy to music energy.
    """
    try:
        y, sr = librosa.load(music_path, sr=None)
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        times = librosa.frames_to_time(
            np.arange(len(rms)), sr=sr, hop_length=hop_length
        )
        energy_map = [
            {"time": round(float(t), 2), "energy": round(float(e), 4)}
            for t, e in zip(times, rms)
        ]
        return energy_map
    except Exception:
        return []