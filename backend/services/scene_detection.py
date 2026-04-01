from scenedetect import open_video, SceneManager
from scenedetect.detectors import ContentDetector

def detect_scenes(video_path: str) -> list:
    video = open_video(video_path)
    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=27.0))
    scene_manager.detect_scenes(video)
    scene_list = scene_manager.get_scene_list()

    scenes = []
    for start, end in scene_list:
        scenes.append({
            "start_sec": start.get_seconds(),
            "end_sec": end.get_seconds()
        })
    return scenes