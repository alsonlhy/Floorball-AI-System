import os
import cv2

# --- Configuration ---
VIDEO_FILENAME = "floorball_clip.mp4"
OUTPUT_FOLDER = "training_frames"

def extract_and_mask(video_path, output_dir):
    """Extracts frames, draws blackout rectangles, and saves the images."""
    print("Extracting and masking frames...")
    
    # Safety check to ensure you named the screen recording correctly
    if not os.path.exists(video_path):
        print(f"❌ ERROR: Cannot find '{video_path}'. Make sure your screen recording is in the exact same folder as this script!")
        return
        
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    cap = cv2.VideoCapture(video_path)
    
    # Calculate frame skip (roughly 2 frames per second)
    frame_rate = int(cap.get(cv2.CAP_PROP_FPS))
    frame_skip = frame_rate // 2 if frame_rate > 0 else 15 
    
    count = 0
    saved = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if count % frame_skip == 0:
            # Mask 1: Top Timestamp
            cv2.rectangle(frame, (680, 60), (1050, 110), (0, 0, 0), -1)
            
            # Mask 2: Bottom PiP Scoreboard overlay
            cv2.rectangle(frame, (0, 700), (1570, 1150), (0, 0, 0), -1)
            
            # Save the image
            filename = os.path.join(output_dir, f"frame_{saved:04d}.jpg")
            cv2.imwrite(filename, frame)
            saved += 1
            
        count += 1
        
    cap.release()
    print(f"✅ Done! Extracted {saved} masked frames into '{output_dir}'.")

# --- Execute the Pipeline ---
if __name__ == "__main__":
    # We skip the download and go straight to extraction!
    extract_and_mask(VIDEO_FILENAME, OUTPUT_FOLDER)