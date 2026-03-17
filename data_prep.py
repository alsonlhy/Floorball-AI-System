import os
import cv2
import subprocess
import sys  # Added to fix the Windows path error

# --- Configuration ---
YOUTUBE_URL = "https://www.youtube.com/watch?v=FbRE3OghDTk&t=5218s"  # Add the actual link here
START_TIME = "01:24:00"                
END_TIME = "01:24:10"                  
VIDEO_FILENAME = "floorball_clip.mp4"
OUTPUT_FOLDER = "training_frames"

def download_clip(youtube_url, start, end, output_filename):
    """Downloads a specific time slice from a YouTube video."""
    print(f"Downloading clip from {start} to {end}...")
    
    command = [
        sys.executable, "-m", "yt-dlp",  # Safely calls yt-dlp through Python
        "--cookies-from-browser", "brave",  # Bypasses the members-only restriction! Change "chrome" to "edge" or "firefox" if needed.
        "--download-sections", f"*{start}-{end}",
        "--force-keyframes-at-cuts",
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "-o", output_filename,
        youtube_url
    ]
    
    # Run the command in the terminal
    subprocess.run(command)
    print("Download complete!\n")

def extract_and_mask(video_path, output_dir):
    """Extracts frames, draws blackout rectangles, and saves the images."""
    print("Extracting and masking frames...")
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    cap = cv2.VideoCapture(video_path)
    
    # Get the frame rate to calculate how many frames to skip
    frame_rate = int(cap.get(cv2.CAP_PROP_FPS))
    
    # We want roughly 2 frames per second to avoid identical consecutive images
    frame_skip = frame_rate // 2 if frame_rate > 0 else 15 
    
    count = 0
    saved = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if count % frame_skip == 0:
            # Mask 1: Top Timestamp
            cv2.rectangle(frame, (600, 0), (1320, 70), (0, 0, 0), -1)
            
            # Mask 2: Bottom PiP Scoreboard overlay
            cv2.rectangle(frame, (350, 650), (1570, 1080), (0, 0, 0), -1)
            
            # Save the image
            filename = os.path.join(output_dir, f"frame_{saved:04d}.jpg")
            cv2.imwrite(filename, frame)
            saved += 1
            
        count += 1
        
    cap.release()
    print(f"Done! Extracted {saved} masked frames into '{output_dir}'.")

if __name__ == "__main__":
    download_clip(YOUTUBE_URL, START_TIME, END_TIME, VIDEO_FILENAME)
    extract_and_mask(VIDEO_FILENAME, OUTPUT_FOLDER)