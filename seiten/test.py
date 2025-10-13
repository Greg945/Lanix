# import streamlit as st

# import pandas as pd
# import numpy as np

# import os
# import uuid
# from pathlib import Path

# from PIL import Image
# from io import BytesIO
# import base64


# if "uploaded_images" not in st.session_state:
#     st.session_state.uploaded_images = []

# # st.session_state.test_selector = "Home phone"


# # option = st.selectbox(
# #     "How would you like to be contacted?",
# #     ("Email", "Home phone", "Mobile phone"),
# #     index=None,
# #     key="test_selector"
# # )

# # st.write("You selected:", option)

# # st.write(st.session_state)


# def image_to_base64(img):
#     if img:
#         # Öffne das Bild mit PIL
#         pil_image = Image.open(img)
#         with BytesIO() as buffer:
#             pil_image.save(buffer, "JPEG")
#             raw_base64 = base64.b64encode(buffer.getvalue()).decode()
#             return f"data:image/png;base64,{raw_base64}"


# # Chat input
# prompt = st.chat_input("Sag was und lade ein Bild hoch", accept_file="multiple", file_type=["jpg", "jpeg", "png"])



# if prompt and prompt["files"]:
#     #print(prompt["files"], " Laenge: ", len(prompt["files"]), " session state: ", st.session_state.uploaded_images)

#     for image in prompt["files"]:
#         st.session_state.uploaded_images.append(image)
#         #print(image)
    
#     #st.write(st.session_state)
#     #print(len(st.session_state.uploaded_images))

#     df = pd.DataFrame([
#         {
#             "name": image.name,
#             "apps": image_to_base64(image)
#         }
#             for image in st.session_state.uploaded_images
#     ])
#     st.dataframe(
#         df,
#         column_config={
#             "apps": st.column_config.ImageColumn(
#                 "Preview Image", help="Bild-Vorschau"
#             )
#         },
#         use_container_width=True,
#         hide_index=True,
#         selection_mode="multi-row",
#         row_height=100
#     )




import asyncio
import base64
import io
import os
import sys
import threading
import queue
import time
from typing import List, Dict, Any

import av
import numpy as np
import streamlit as st
import streamlit_webrtc as webrtc
import pyaudio
import PIL.Image
from PIL import Image

from google import genai

# Configure Streamlit page
st.set_page_config(page_title="Gemini Live API Demo", page_icon="🤖")

# Check Python version for TaskGroup and ExceptionGroup
if sys.version_info < (3, 11, 0):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

# Audio constants
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

# Gemini model configuration
MODEL = "models/gemini-2.0-flash-live-001"
CONFIG = {"response_modalities": ["AUDIO"]}

# Initialize PyAudio
pya = pyaudio.PyAudio()

# Initialize Gemini client
@st.cache_resource
def get_client():
    return genai.Client(api_key=st.secrets["GEMINI_API_KEY"], http_options={"api_version": "v1beta"})

# Session state initialization
if "client" not in st.session_state:
    st.session_state.client = get_client()
if "audio_in_queue" not in st.session_state:
    st.session_state.audio_in_queue = queue.Queue()
if "out_queue" not in st.session_state:
    st.session_state.out_queue = queue.Queue(maxsize=5)
if "session" not in st.session_state:
    st.session_state.session = None
if "is_running" not in st.session_state:
    st.session_state.is_running = False
if "output_text" not in st.session_state:
    st.session_state.output_text = ""
if "should_stop" not in st.session_state:
    st.session_state.should_stop = False

# Helper function for video frames
def process_frame(frame):
    img = PIL.Image.fromarray(frame.to_ndarray(format="rgb24"))
    img.thumbnail([1024, 1024])
    
    image_io = io.BytesIO()
    img.save(image_io, format="jpeg")
    image_io.seek(0)
    
    mime_type = "image/jpeg"
    image_bytes = image_io.read()
    
    return {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

# Audio callback for WebRTC
def audio_frame_callback(frame):
    sound = frame.to_ndarray().flatten().astype(np.int16).tobytes()
    if st.session_state.is_running and not st.session_state.should_stop:
        try:
            st.session_state.out_queue.put({"data": sound, "mime_type": "audio/pcm"}, block=False)
        except queue.Full:
            pass
    return frame

# Video callback for WebRTC
def video_frame_callback(frame):
    if st.session_state.is_running and not st.session_state.should_stop:
        try:
            img_dict = process_frame(frame)
            st.session_state.out_queue.put(img_dict, block=False)
        except queue.Full:
            pass
    return frame

# Function to send messages to Gemini
async def send_text(text):
    if st.session_state.session:
        await st.session_state.session.send(input=text, end_of_turn=True)

# Function to send real-time data from queue to Gemini
async def send_realtime():
    while st.session_state.is_running and not st.session_state.should_stop:
        try:
            msg = st.session_state.out_queue.get(timeout=0.1)
            if st.session_state.session:
                await st.session_state.session.send(input=msg)
        except queue.Empty:
            await asyncio.sleep(0.01)
        except Exception as e:
            print(f"Error in send_realtime: {e}")
            break

# Function to receive audio from Gemini
async def receive_responses():
    if not st.session_state.session:
        return
    
    while st.session_state.is_running and not st.session_state.should_stop:
        try:
            turn = st.session_state.session.receive()
            async for response in turn:
                if data := response.data:
                    st.session_state.audio_in_queue.put(data)
                if text := response.text:
                    st.session_state.output_text += text
                    
            # Clear audio queue after turn complete
            while not st.session_state.audio_in_queue.empty():
                st.session_state.audio_in_queue.get_nowait()
                
        except Exception as e:
            print(f"Error in receive_responses: {e}")
            break

# Function to play audio received from Gemini
def play_audio():
    audio_stream = None
    try:
        audio_stream = pya.open(
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True
        )
        
        while st.session_state.is_running and not st.session_state.should_stop:
            try:
                bytestream = st.session_state.audio_in_queue.get(timeout=0.1)
                audio_stream.write(bytestream)
            except queue.Empty:
                time.sleep(0.01)
            except Exception as e:
                print(f"Error in play_audio: {e}")
                break
    finally:
        if audio_stream:
            audio_stream.stop_stream()
            audio_stream.close()

# Main function to run the Gemini Live session
async def run_gemini_live():
    try:
        st.session_state.is_running = True
        st.session_state.should_stop = False
        st.session_state.output_text = ""
        
        # Start audio playback in a separate thread
        audio_thread = threading.Thread(target=play_audio)
        audio_thread.daemon = True
        audio_thread.start()
        
        session = await st.session_state.client.aio.live.connect(model=MODEL, config=CONFIG)
        st.session_state.session = session
        
        try:
            async with asyncio.TaskGroup() as tg:
                # Create tasks
                tasks = []
                tasks.append(tg.create_task(send_realtime()))
                tasks.append(tg.create_task(receive_responses()))
                
                # Wait for tasks to complete
                await asyncio.gather(*tasks)
        finally:
            await session.close()
            
    except Exception as e:
        st.error(f"Error: {e}")
    finally:
        st.session_state.is_running = False
        st.session_state.should_stop = True
        st.session_state.session = None

# Function to handle starting the Gemini Live session
def start_gemini_live():
    st.session_state.should_stop = False
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run_gemini_live())
    finally:
        loop.close()

# Function to handle stopping the Gemini Live session
def stop_gemini_live():
    st.session_state.should_stop = True
    st.session_state.is_running = False

# Function to handle user text input
async def handle_user_input_async():
    user_input = st.session_state.user_input
    if user_input and st.session_state.is_running:
        st.session_state.messages.append({"role": "user", "content": user_input})
        await send_text(user_input)
        st.session_state.user_input = ""

def handle_user_input():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(handle_user_input_async())
    finally:
        loop.close()

# Streamlit UI
st.title("Gemini Live API Demo")

# WebRTC setup for video
st.subheader("Camera Feed")
webrtc_ctx = webrtc.webrtc_streamer(
    key="gemini-live",
    video_frame_callback=video_frame_callback,
    audio_frame_callback=audio_frame_callback,
    rtc_configuration={"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]},
    media_stream_constraints={"video": True, "audio": True},
)

# Control buttons
col1, col2 = st.columns(2)
with col1:
    start_button = st.button("Start Session", on_click=start_gemini_live, disabled=st.session_state.is_running)
with col2:
    stop_button = st.button("Stop Session", on_click=stop_gemini_live, disabled=not st.session_state.is_running)

# Text input for conversation
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display conversation
st.subheader("Conversation")
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.write(message["content"])

# Show Gemini's response
if st.session_state.output_text:
    with st.chat_message("assistant"):
        st.write(st.session_state.output_text)

# Text input for user messages
st.text_input("Type your message", key="user_input", on_change=handle_user_input)

# Status indicator
if st.session_state.is_running:
    st.success("Session is active")
else:
    st.warning("Session is inactive")

# Instructions
with st.expander("Instructions"):
    st.markdown("""
    1. Enter your Google API Key
    2. Allow camera and microphone access
    3. Click "Start Session" to begin
    4. Speak or type your message
    5. Use headphones to prevent echo
    6. Click "Stop Session" when done
    """)