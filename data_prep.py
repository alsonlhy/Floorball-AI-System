import os
import cv2
import subprocess
import sys

# --- Configuration ---
YOUTUBE_URL = "https://www.youtube.com/watch?v=FbRE3OghDTk"  # Add the actual link here
START_TIME = "01:24:00"                
END_TIME = "01:24:10"                  
VIDEO_FILENAME = "floorball_clip.mp4"
OUTPUT_FOLDER = "training_frames"

def download_clip(youtube_url, start, end, output_filename):
    """Downloads a specific time slice from a YouTube video."""
    print(f"Downloading clip from {start} to {end}...")
    
    # If an old file exists, delete it so we don't accidentally read old data
    if os.path.exists(output_filename):
        os.remove(output_filename)
        print(f"Deleted old {output_filename} to make way for the new one.")
    
    command = [
        sys.executable, "-m", "yt_dlp",
        "--cookies", "cookies.txt",  
        "--download-sections", f"*{start}-{end}",
        "--force-keyframes-at-cuts",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",  # <--- NEW: Forces the final file to be an exact MP4
        "-o", output_filename,
        "https://www.youtube.com/watch?v=FbRE3OghDTk"
    ]
    
    subprocess.run(command)
    print("Download process finished!\n")

def extract_and_mask(video_path, output_dir):
    """Extracts frames, draws blackout rectangles, and saves the images."""
    print("Extracting and masking frames...")
    
    # --- NEW: Safety check to see if the file actually exists and has data ---
    if not os.path.exists(video_path):
        print(f"❌ ERROR: Cannot find '{video_path}'. The download likely failed or saved with a different name.")
        return
        
    if os.path.getsize(video_path) == 0:
        print(f"❌ ERROR: '{video_path}' is 0 bytes. YouTube blocked the section download.")
        return
    # -------------------------------------------------------------------------
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    cap = cv2.VideoCapture(video_path)
    frame_rate = int(cap.get(cv2.CAP_PROP_FPS))
    frame_skip = frame_rate // 2 if frame_rate > 0 else 15 
    
    count = 0
    saved = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if count % frame_skip == 0:
            cv2.rectangle(frame, (600, 0), (1320, 70), (0, 0, 0), -1)
            cv2.rectangle(frame, (350, 650), (1570, 1080), (0, 0, 0), -1)
            
            filename = os.path.join(output_dir, f"frame_{saved:04d}.jpg")
            cv2.imwrite(filename, frame)
            saved += 1
            
        count += 1
        
    cap.release()
    print(f"✅ Done! Extracted {saved} masked frames into '{output_dir}'.")

if __name__ == "__main__":
    download_clip(YOUTUBE_URL, START_TIME, END_TIME, VIDEO_FILENAME)
    extract_and_mask(VIDEO_FILENAME, OUTPUT_FOLDER)