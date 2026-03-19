import cv2
from ultralytics import YOLO

# --- Configuration ---
MODEL_PATH = "kings_castle.pt"
VIDEO_INPUT = "floorball_clip.mp4"
VIDEO_OUTPUT = "annotated_match.mp4"

def run_tracker():
    print("Loading King's Castle AI Model...")
    model = YOLO(MODEL_PATH)
    
    cap = cv2.VideoCapture(VIDEO_INPUT)
    if not cap.isOpened():
        print(f"❌ ERROR: Cannot find '{VIDEO_INPUT}'")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(VIDEO_OUTPUT, fourcc, fps, (width, height))

    print("Running inference... (Press 'q' in the video window to stop early)")

    frame_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # Mask 1: Top Timestamp
        cv2.rectangle(frame, (680, 60), (1050, 110), (0, 0, 0), -1)
        # Mask 2: Bottom PiP Scoreboard overlay
        cv2.rectangle(frame, (0, 700), (1570, 1150), (0, 0, 0), -1)

        # Run the AI on the newly masked frame (lowered confidence to 25%)
        results = model.predict(frame, conf=0.10, verbose=False)

        num_boxes = len(results[0].boxes)
        print(f"Frame {frame_count}: Detected {num_boxes} objects")

        # Draw the bounding boxes and labels onto the frame
        annotated_frame = results[0].plot()

        # Save the frame to the new video file
        out.write(annotated_frame)
        cv2.imshow("King's Castle AI Tracker", annotated_frame)

        # Press 'q' to quit early
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

        frame_count += 1

    cap.release()
    out.release()
    cv2.destroyAllWindows()
    print(f"✅ Done! Annotated video saved as '{VIDEO_OUTPUT}'")

if __name__ == "__main__":
    run_tracker()