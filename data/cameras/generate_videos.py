import cv2
import numpy as np
import os

print("Generating test videos for realistic playback...")

def create_dummy_video(filename, text, fps=30, duration=5):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    width, height = 640, 480
    fourcc = cv2.VideoWriter_fourcc(*'mp4v') # or 'avc1'
    out = cv2.VideoWriter(filepath, fourcc, fps, (width, height))
    
    for i in range(fps * duration):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        # Random noise to simulate movement
        noise = np.random.randint(0, 50, (height, width, 3), dtype=np.uint8)
        frame = cv2.add(frame, noise)
        
        cv2.putText(frame, text, (50, height // 2), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        cv2.putText(frame, f"Frame: {i}", (50, height // 2 + 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)
        
        out.write(frame)
    
    out.release()
    print(f"Created {filename}")

if __name__ == "__main__":
    create_dummy_video("cam_1.mp4", "CAMERA 1 FEED")
    create_dummy_video("cam_2.mp4", "CAMERA 2 FEED")
    create_dummy_video("cam_3.mp4", "CAMERA 3 FEED")
    print("Done generating videos!")
