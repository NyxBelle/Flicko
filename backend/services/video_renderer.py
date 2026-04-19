import subprocess
import os


def render_video(
    edit_plan: dict,
    source_dir: str,
    output_path: str,
    is_free_plan: bool = False
) -> str:
    clips = edit_plan["clips"]
    tmp_clips = []

    # Step 1: Trim each clip
    for i, clip in enumerate(clips):
        src = os.path.join(source_dir, clip["source_file"])
        tmp = os.path.join(source_dir, f"_tmp_{i}.mp4")

        # Re-encode for compatibility
        subprocess.run([
            "ffmpeg", "-y",
            "-ss", str(clip["start_sec"]),
            "-to", str(clip["end_sec"]),
            "-i", src,
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
            "-r", "30",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-ar", "44100",
            tmp
        ], check=True)
        tmp_clips.append(tmp)

    # Step 2: Concat
    concat_file = os.path.join(source_dir, "_concat.txt")
    with open(concat_file, "w") as f:
        for tc in tmp_clips:
            f.write(f"file '{tc}'\n")

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

    # Step 3: Mix in background music if provided
    current_path = merged_path
    if edit_plan.get("music_local_path") and os.path.exists(edit_plan["music_local_path"]):
        music_mixed = os.path.join(source_dir, "_music_mixed.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-i", current_path,
            "-i", edit_plan["music_local_path"],
            "-filter_complex",
            "[1:a]volume=0.3[music];[0:a][music]amix=inputs=2:duration=first[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            music_mixed
        ], check=True)
        os.remove(current_path)
        current_path = music_mixed

    # Step 4: Mix in voiceover if provided
    vo_path = edit_plan.get("voiceover", {}).get("local_path")
    if vo_path and os.path.exists(vo_path):
        vo_mixed = os.path.join(source_dir, "_vo_mixed.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-i", current_path,
            "-i", vo_path,
            "-filter_complex",
            "[0:a]volume=0.4[orig];[1:a]volume=1.0[vo];[orig][vo]amix=inputs=2:duration=first[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            vo_mixed
        ], check=True)
        os.remove(current_path)
        current_path = vo_mixed

    # Step 5: Burn captions if transcript available
    if edit_plan.get("captions_srt_path") and os.path.exists(edit_plan["captions_srt_path"]):
        from services.captions import burn_captions
        captioned = os.path.join(source_dir, "_captioned.mp4")
        burn_captions(
            video_path=current_path,
            srt_path=edit_plan["captions_srt_path"],
            output_path=captioned,
            style=edit_plan.get("caption_style", "tiktok")
        )
        os.remove(current_path)
        current_path = captioned

    # Step 6: Add watermark for free users
    if is_free_plan:
        watermarked = os.path.join(source_dir, "_watermarked.mp4")
        subprocess.run([
            "ffmpeg", "-y",
            "-i", current_path,
            "-vf", "drawtext=text='Made with Flicko':fontcolor=white:fontsize=20:alpha=0.7:x=w-tw-20:y=h-th-20:box=1:boxcolor=black@0.3:boxborderw=5",
            "-codec:a", "copy",
            watermarked
        ], check=True)
        os.remove(current_path)
        current_path = watermarked

    os.rename(current_path, output_path)
    return output_path