import asyncio
import logging
import queue
import threading
from collections import deque

import av
import numpy as np
import pydub
import streamlit as st
from google import genai

from streamlit_webrtc import WebRtcMode, webrtc_streamer

# Für ältere Python-Versionen
if not hasattr(asyncio, 'TaskGroup'):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

# Konfiguration
FORMAT, CHANNELS, RATE, CHUNK = "int16", 1, 16000, 1024
MODEL = "models/gemini-2.0-flash-live-001"
debug = False  # Debug-Modus für Exception-Handling

# Logging setup
logger = logging.getLogger(__name__)

# Client initialisieren
client = genai.Client(
    http_options={"api_version": "v1beta"}, 
    api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8"
)

# Globale Variablen für Audio-Frames
frames_deque = deque()
frames_deque_lock = threading.Lock()
gemini_session = None
running = True

def get_ice_servers():
    """STUN server für WebRTC"""
    return [{"urls": ["stun:stun.l.google.com:19302"]}]

def main():
    st.header("Gemini Live Stream mit WebRTC")
    st.markdown("Mikrofon-Zugriff aktivieren und dann 'q' eingeben, um zu beenden.")
    
    # Audio-Callback-Funktion für WebRTC
    def audio_frames_callback(frame):
        with frames_deque_lock:
            frames_deque.append(frame)
        return frame
    
    # WebRTC Streamer einrichten mit dem Audio-Callback
    webrtc_ctx = webrtc_streamer(
        key="gemini-live",
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=1024,
        rtc_configuration={"iceServers": get_ice_servers()},
        media_stream_constraints={"video": False, "audio": True},
        audio_frame_callback=audio_frames_callback,
    )
    
    if webrtc_ctx.state.playing:
        # Async Event Loop im Hintergrund starten
        if not hasattr(st, "gemini_thread"):
            st.gemini_thread = threading.Thread(
                target=run_async_tasks,
                args=(webrtc_ctx,), 
                daemon=True
            )
            st.gemini_thread.start()

def run_async_tasks(webrtc_ctx):
    """Startet die async Aufgaben im Hintergrund"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main_async(webrtc_ctx))
    finally:
        loop.close()

async def main_async(webrtc_ctx):
    """Hauptfunktion für asynchrone Verarbeitung"""
    global gemini_session, running
    
    print("Verbinde mit Gemini...")
    
    try:
        # Gemini-Session starten
        async with client.aio.live.connect(
            model=MODEL,
            config={"response_modalities": ["TEXT"]}
        ) as session:
            gemini_session = session
            print("Verbunden mit Gemini. Sie können jetzt sprechen!")
            
            async with asyncio.TaskGroup() as tg:
                # Audio-Erfassung und -Versand
                tg.create_task(capture_and_send_audio(session))
                # Text empfangen
                tg.create_task(receive_text(session))
                # Text-Eingabe verarbeiten
                tg.create_task(handle_text_input(session))
                
    except asyncio.CancelledError:
        print("\nBeendigung durch Benutzer")
    except Exception as e:
        print(f"\nFehler: {e}")
    finally:
        running = False
        print("Gemini-Session beendet.")

async def capture_and_send_audio(session):
    """Audio aufnehmen und an Gemini senden"""
    global running
    
    while running:
        # Audio-Frames verarbeiten
        frames_to_process = []
        with frames_deque_lock:
            while frames_deque:
                frames_to_process.append(frames_deque.popleft())
        
        if frames_to_process:
            sound_chunk = pydub.AudioSegment.empty()
            for audio_frame in frames_to_process:
                sound = pydub.AudioSegment(
                    data=audio_frame.to_ndarray().tobytes(),
                    sample_width=audio_frame.format.bytes,
                    frame_rate=audio_frame.sample_rate,
                    channels=len(audio_frame.layout.channels),
                )
                sound_chunk += sound
            
            if len(sound_chunk) > 0:
                # Auf das richtige Format konvertieren
                sound_chunk = sound_chunk.set_channels(1).set_frame_rate(RATE)
                data = np.array(sound_chunk.get_array_of_samples()).tobytes()
                
                # An Gemini senden
                try:
                    await session.send(input={"data": data, "mime_type": "audio/pcm"})
                    #print(".")
                except Exception as e:
                    print(f"Fehler beim Senden von Audio: {e}")
        
        await asyncio.sleep(0.1)

async def receive_text(session):
    """Antworten von Gemini empfangen und anzeigen"""
    global running
    
    while running:
        try:
            turn = session.receive()
            async for response in turn:
                if data := response.data:
                    print(data)
                    #continue
                if text := response.text:
                    print(text, end="")
        except Exception as e:
            print(f"\nFehler beim Empfangen von Text: {e}")
            await asyncio.sleep(1)

async def handle_text_input(session):
    """Benutzereingaben verarbeiten"""
    global running
    
    while running:
        text = await asyncio.to_thread(input, "\nNachricht > ")
        if text.lower() == "q":
            running = False
            raise asyncio.CancelledError("Benutzer hat Beendigung angefordert")
        
        await session.send(input=text or ".", end_of_turn=True)

if __name__ == "__main__":
    logging.basicConfig(
        format="[%(asctime)s] %(levelname)7s from %(name)s in %(pathname)s:%(lineno)d: "
        "%(message)s",
        force=True,
    )
    logger.setLevel(logging.INFO)
    
    st_webrtc_logger = logging.getLogger("streamlit_webrtc")
    st_webrtc_logger.setLevel(logging.WARNING)
    
    main()