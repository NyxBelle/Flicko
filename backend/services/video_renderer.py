import subprocess
import os

def render_video(edit_plan: dict, source_dir: str, output_path: str, is_free_plan: bool = False) -> str:
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

    # Concatenate clips
    merged_path = os.path.join(source_dir, "_merged.mp4")
    subprocess.run([
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concat_file,
        "-c", "copy",
        merged_path
    ], check=True)

    for tc in tmp_clips:
        os.remove(tc)
    os.remove(concat_file)

    # Add watermark for free plan users
    if is_free_plan:
        subprocess.run([
            "ffmpeg", "-y",
            "-i", merged_path,
            "-vf", "drawtext=text='Made with Flicko':fontcolor=white:fontsize=24:alpha=0.6:x=w-tw-20:y=h-th-20",
            "-codec:a", "copy",
            output_path
        ], check=True)
        os.remove(merged_path)
    else:
        os.rename(merged_path, output_path)

    return output_path