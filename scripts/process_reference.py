# pip install yt-dlp mediapipe opencv-python supabase python-dotenv
import yt_dlp, cv2, mediapipe as mp, json, os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # from Supabase -> Settings -> API -> service_role
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

mp_pose = mp.solutions.pose
pose = mp_pose.Pose(static_image_mode=False, min_detection_confidence=0.5)

def download_youtube(url, filename):
    ydl_opts = {'format': 'mp4/best', 'outtmpl': filename, 'quiet': True}
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    return filename

def process_video_to_poses(video_path):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    poses = []
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret: break
        # Process every 3rd frame to keep JSON small
        if frame_idx % 3 == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = pose.process(rgb)
            if result.pose_landmarks:
                landmarks = [{"x": lm.x, "y": lm.y, "z": lm.z, "v": lm.visibility}
                             for lm in result.pose_landmarks.landmark]
                poses.append({"frame": frame_idx, "t": frame_idx / fps, "landmarks": landmarks})
        frame_idx += 1
    cap.release()
    return {"fps": fps, "total_frames": frame_idx, "poses": poses}

def main():
    form_slug = "taegeuk-1-jang"
    urls = {
        "front": "https://youtu.be/L4T0ixGVupU",
        "side": "https://youtu.be/ac9k87OqD7E"
    }
    combined = {"form": form_slug, "videos": {}}

    for angle, url in urls.items():
        print(f"Downloading {angle}: {url}")
        video_file = f"/tmp/{form_slug}-{angle}.mp4"
        download_youtube(url, video_file)
        print(f"Processing pose for {angle}...")
        pose_data = process_video_to_poses(video_file)
        combined["videos"][angle] = pose_data
        # Save individual JSON to storage
        json_path = f"/tmp/{form_slug}-{angle}.json"
        with open(json_path, "w") as f:
            json.dump(pose_data, f)
        with open(json_path, "rb") as f:
            supabase.storage.from_("reference-poses").upload(f"{form_slug}-{angle}.json", f, {"upsert": "true"})
        print(f"Uploaded {form_slug}-{angle}.json")
        os.remove(video_file)

    # Save combined
    with open(f"/tmp/{form_slug}-combined.json", "w") as f:
        json.dump(combined, f)
    with open(f"/tmp/{form_slug}-combined.json", "rb") as f:
        supabase.storage.from_("reference-poses").upload(f"{form_slug}-combined.json", f, {"upsert": "true"})

    # Update forms table
    supabase.table("forms").update({
        "reference_pose_url": f"{form_slug}-combined.json"
    }).eq("slug", form_slug).execute()
    print("Done. Reference poses cached, forms table updated.")

if __name__ == "__main__":
    main()