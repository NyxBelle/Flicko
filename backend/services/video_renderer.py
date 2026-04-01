import subprocess
import os

def render_video(edit_plan: dict, source_dir: str, output_path: str) -> str:
    clips = edit_plan["clips"]
    tmp_clips = []

    for i, clip in enumerate(clips):
        src = os.path.join(source_dir, clip["source_file"])
        tmp = os.path.join(source_dir, f"_tmp_{i}.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(clip["start_sec"]),
            "-to", str(clip["end_sec"]),
            "-i", src,
            "-c", "copy",
            tmp
        ], check=True)
        tmp_clips.append(tmp)

    concat_file = os.path.join(source_dir, "_concat.txt")
    with open(concat_file, "w") as f:
        for tc in tmp_clips:
            f.write(f"file '{tc}'\n")

    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        output_path
    ], check=True)

    for tc in tmp_clips:
        os.remove(tc)
    os.remove(concat_file)

    return output_path