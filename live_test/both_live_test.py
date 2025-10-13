import logging
import logging.handlers
import queue
import threading
import time
import asyncio
import base64
import io
import os
import sys
from collections import deque
from pathlib import Path
from typing import List

import av
import numpy as np
import pydub
import streamlit as st
from google import genai
import PIL.Image

from streamlit_webrtc import WebRtcMode, webrtc_streamer

# Konfiguration für das Logging
HERE = Path(__file__).parent
logger = logging.getLogger(__name__)

# Gemini Live API Konfiguration
MODEL = "models/gemini-2.0-flash-live-001"
CONFIG = {"response_modalities": ["TEXT"]}

# WICHTIG: Ersetzen Sie diesen API-Key mit Ihrem eigenen
GOOGLE_API_KEY = "Ihr-Google-API-Key-hier"
client = genai.Client(http_options={"api_version": "v1beta"}, api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")

# Wenn Python-Version < 3.11, importieren wir benötigte Module
if sys.version_info < (3, 11, 0):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

# Funktion zum Abrufen der ICE-Server für WebRTC
@st.cache_data
def get_ice_servers():
    """Einfache STUN-Server für WebRTC-Verbindung"""
    return [{"urls": ["stun:stun.l.google.com:19302"]}]

# Thread-sicherer Zugriff auf Streamlit
def safe_update_text(text_element, text):
    try:
        text_element.markdown(text)
    except Exception as e:
        logger.error(f"Fehler beim Aktualisieren des Textelements: {e}")
        # Hier können wir keine weitere Aktion durchführen, da die Session fehlt

# Hauptfunktion für die Streamlit-App
def main():
    st.header("Streamlit WebRTC mit Gemini Live API")
    st.markdown(
        """
        Diese App kombiniert WebRTC für die Echtzeit-Audio/Video-Übertragung mit der 
        Gemini Live API für KI-gestützte Verarbeitung und Antworten.
        
        Sprechen Sie in das Mikrofon, und Gemini wird in Echtzeit antworten.
        """
    )

    # App-Modi
    sound_only_page = "Nur Audio (sendonly)"
    with_video_page = "Mit Video (sendrecv)"
    app_mode = st.selectbox("Wählen Sie den App-Modus", [sound_only_page, with_video_page])

    if app_mode == sound_only_page:
        app_gemini_audio()
    elif app_mode == with_video_page:
        app_gemini_audio_video()

# Konvertiert WebRTC-Audioframes in ein Format, das für Gemini geeignet ist
def convert_audio_for_gemini(audio_frames):
    sound_chunk = pydub.AudioSegment.empty()
    
    for audio_frame in audio_frames:
        sound = pydub.AudioSegment(
            data=audio_frame.to_ndarray().tobytes(),
            sample_width=audio_frame.format.bytes,
            frame_rate=audio_frame.sample_rate,
            channels=len(audio_frame.layout.channels),
        )
        sound_chunk += sound
    
    # Konvertieren zu PCM-Format mit 16000 Hz (für Gemini)
    if len(sound_chunk) > 0:
        sound_chunk = sound_chunk.set_channels(1).set_frame_rate(16000)
        audio_bytes = sound_chunk.raw_data
        return {"data": audio_bytes, "mime_type": "audio/pcm"}
    
    return None

# Konvertiert WebRTC-Videoframes in ein Format, das für Gemini geeignet ist
def convert_video_for_gemini(video_frame):
    img = PIL.Image.fromarray(video_frame.to_ndarray(format="rgb24"))
    img.thumbnail([1024, 1024])  # Gemini erwartet kleinere Bilder
    
    image_io = io.BytesIO()
    img.save(image_io, format="jpeg")
    image_io.seek(0)
    
    mime_type = "image/jpeg"
    image_bytes = image_io.read()
    return {"mime_type": mime_type, "data": base64.b64encode(image_bytes).decode()}

# Nur Audio-Modus mit Gemini
def app_gemini_audio():
    webrtc_ctx = webrtc_streamer(
        key="gemini-audio",
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=1024,
        frontend_rtc_configuration={"iceServers": get_ice_servers()},
        media_stream_constraints={"video": False, "audio": True},
    )

    status_indicator = st.empty()
    text_output = st.empty()
    
    if not webrtc_ctx.state.playing:
        return

    status_indicator.write("Verbindung zu Gemini Live API wird hergestellt...")
    
    # Gemini-Session initialisieren
    gemini_session = None
    gemini_task = None
    audio_queue = asyncio.Queue()
    response_queue = queue.Queue()
    
    # Asynchrone Funktion zum Senden von Audio an Gemini und Empfangen von Antworten
    async def process_with_gemini():
        nonlocal gemini_session
        try:
            async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
                gemini_session = session
                
                # Senden eines ersten Texts, um die Sitzung zu starten
                await gemini_session.send(input="Hallo, ich bin bereit, auf deine Stimme zu hören.", end_of_turn=True)
                
                # Empfangen der ersten Antwort
                turn = gemini_session.receive()
                async for response in turn:
                    if text := response.text:
                        response_queue.put(text)
                
                # Audio-Verarbeitung in einer Schleife
                while True:
                    audio_data = await audio_queue.get()
                    if audio_data is None:
                        break
                    
                    # Audio an Gemini senden
                    await gemini_session.send(input=audio_data)
                    
                    # Warten auf Aktivitäts-Stille (500ms), dann end_of_turn senden
                    try:
                        await asyncio.wait_for(audio_queue.get(), timeout=0.5)
                        continue
                    except asyncio.TimeoutError:
                        await gemini_session.send(input="", end_of_turn=True)
                    
                    # Antwort von Gemini empfangen
                    turn = gemini_session.receive()
                    async for response in turn:
                        if text := response.text:
                            response_queue.put(text)
        
        except Exception as e:
            logger.error(f"Fehler in Gemini-Verarbeitung: {e}")
            response_queue.put(f"Fehler: {e}")
        finally:
            pass  # Session wird durch den Context Manager geschlossen
    
    # Thread zur Verarbeitung von Antworten
    def response_processor():
        while webrtc_ctx.state.playing:
            try:
                response = response_queue.get(timeout=0.1)
                safe_update_text(text_output, f"**Gemini:** {response}")
            except queue.Empty:
                continue
    
    # Starten des Gemini-Tasks
    event_loop = asyncio.new_event_loop()
    def run_gemini_task():
        event_loop.run_until_complete(process_with_gemini())
    
    gemini_thread = threading.Thread(target=run_gemini_task, daemon=True)
    gemini_thread.start()
    
    # Starten des Response-Processors
    response_thread = threading.Thread(target=response_processor, daemon=True)
    response_thread.start()
    
    # Hauptschleife für Audio-Verarbeitung
    try:
        while webrtc_ctx.state.playing:
            if webrtc_ctx.audio_receiver:
                try:
                    audio_frames = webrtc_ctx.audio_receiver.get_frames(timeout=1)
                    
                    status_indicator.write("Verbunden mit Gemini. Sprechen Sie bitte...")
                    
                    # Audio für Gemini konvertieren und in die Queue stellen
                    audio_data = convert_audio_for_gemini(audio_frames)
                    if audio_data:
                        event_loop.call_soon_threadsafe(
                            lambda: asyncio.run_coroutine_threadsafe(
                                audio_queue.put(audio_data), event_loop
                            )
                        )
                
                except queue.Empty:
                    time.sleep(0.1)
                    continue
            else:
                status_indicator.write("AudioReceiver ist nicht eingerichtet. Abbrechen.")
                break
    finally:
        # Cleanup
        if webrtc_ctx.state.playing:
            status_indicator.write("Verbindung wird geschlossen...")
            event_loop.call_soon_threadsafe(
                lambda: asyncio.run_coroutine_threadsafe(
                    audio_queue.put(None), event_loop
                )
            )
            gemini_thread.join(timeout=5)
            response_thread.join(timeout=5)
            event_loop.close()
            status_indicator.write("Verbindung geschlossen.")

# Audio und Video-Modus mit Gemini
def app_gemini_audio_video():
    frames_deque_lock = threading.Lock()
    audio_frames_deque = deque([])
    video_frames_deque = deque([])
    
    # Callback für Audio-Frames
    async def queued_audio_frames_callback(frames: List[av.AudioFrame]) -> av.AudioFrame:
        with frames_deque_lock:
            audio_frames_deque.extend(frames)
        
        # Leere Frames zurückgeben, um "Echo" zu vermeiden
        new_frames = []
        for frame in frames:
            input_array = frame.to_ndarray()
            new_frame = av.AudioFrame.from_ndarray(
                np.zeros(input_array.shape, dtype=input_array.dtype),
                layout=frame.layout.name,
            )
            new_frame.sample_rate = frame.sample_rate
            new_frames.append(new_frame)
        
        return new_frames
    
    # Callback für Video-Frames
    def video_frame_callback(frame):
        with frames_deque_lock:
            video_frames_deque.append(frame)
        return frame
    
    webrtc_ctx = webrtc_streamer(
        key="gemini-audio-video",
        mode=WebRtcMode.SENDRECV,
        queued_audio_frames_callback=queued_audio_frames_callback,
        video_frame_callback=video_frame_callback,
        frontend_rtc_configuration={"iceServers": get_ice_servers()},
        media_stream_constraints={"video": True, "audio": True},
    )
    
    status_indicator = st.empty()
    text_output = st.empty()
    
    if not webrtc_ctx.state.playing:
        return
    
    status_indicator.write("Verbindung zu Gemini Live API wird hergestellt...")
    
    # Gemini-Session initialisieren
    gemini_session = None
    audio_queue = asyncio.Queue()
    video_queue = asyncio.Queue()
    response_queue = queue.Queue()
    
    # Asynchrone Funktion zum Senden von Audio/Video an Gemini und Empfangen von Antworten
    async def process_with_gemini():
        nonlocal gemini_session
        try:
            async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
                gemini_session = session
                
                # Senden eines ersten Texts, um die Sitzung zu starten
                await gemini_session.send(input="Hallo, ich bin bereit, auf deine Stimme zu hören und Video zu sehen.", end_of_turn=True)
                
                # Empfangen der ersten Antwort
                turn = gemini_session.receive()
                async for response in turn:
                    if text := response.text:
                        response_queue.put(text)
                
                # Video-Verarbeitung in einem separaten Task
                async def process_video():
                    while True:
                        video_data = await video_queue.get()
                        if video_data is None:
                            break
                        
                        # Video an Gemini alle 1-2 Sekunden senden
                        await gemini_session.send(input=video_data)
                        await asyncio.sleep(1.5)  # Warte 1.5 Sekunden zwischen Video-Frames
                
                video_task = asyncio.create_task(process_video())
                
                # Audio-Verarbeitung in einer Schleife
                while True:
                    audio_data = await audio_queue.get()
                    if audio_data is None:
                        break
                    
                    # Audio an Gemini senden
                    await gemini_session.send(input=audio_data)
                    
                    # Warten auf Aktivitäts-Stille (500ms), dann end_of_turn senden
                    try:
                        await asyncio.wait_for(audio_queue.get(), timeout=0.5)
                        continue
                    except asyncio.TimeoutError:
                        await gemini_session.send(input="", end_of_turn=True)
                    
                    # Antwort von Gemini empfangen
                    turn = gemini_session.receive()
                    async for response in turn:
                        if text := response.text:
                            response_queue.put(text)
                
                # Video-Task beenden
                video_task.cancel()
                try:
                    await video_task
                except asyncio.CancelledError:
                    pass
        
        except Exception as e:
            logger.error(f"Fehler in Gemini-Verarbeitung: {e}")
            response_queue.put(f"Fehler: {e}")
        finally:
            pass  # Session wird durch den Context Manager geschlossen
    
    # Thread zur Verarbeitung von Antworten
    def response_processor():
        while webrtc_ctx.state.playing:
            try:
                response = response_queue.get(timeout=0.1)
                text_output.markdown(f"**Gemini:** {response}")
            except queue.Empty:
                continue
    
    # Starten des Gemini-Tasks
    event_loop = asyncio.new_event_loop()
    def run_gemini_task():
        event_loop.run_until_complete(process_with_gemini())
    
    gemini_thread = threading.Thread(target=run_gemini_task, daemon=True)
    gemini_thread.start()
    
    # Starten des Response-Processors
    response_thread = threading.Thread(target=response_processor, daemon=True)
    response_thread.start()
    
    # Hauptschleife für Audio/Video-Verarbeitung
    try:
        while webrtc_ctx.state.playing:
            # Audio-Frames verarbeiten
            audio_frames = []
            with frames_deque_lock:
                while len(audio_frames_deque) > 0:
                    frame = audio_frames_deque.popleft()
                    audio_frames.append(frame)
            
            if audio_frames:
                status_indicator.write("Verbunden mit Gemini. Sprechen Sie bitte...")
                
                # Audio für Gemini konvertieren und in die Queue stellen
                audio_data = convert_audio_for_gemini(audio_frames)
                if audio_data:
                    event_loop.call_soon_threadsafe(
                        lambda: asyncio.run_coroutine_threadsafe(
                            audio_queue.put(audio_data), event_loop
                        )
                    )
            
            # Video-Frames verarbeiten (ein Frame alle paar Sekunden)
            video_frames = []
            with frames_deque_lock:
                if len(video_frames_deque) > 0:
                    # Nehmen Sie nur das neueste Frame
                    video_frames.append(video_frames_deque.pop())
                    video_frames_deque.clear()  # Alte Frames löschen
            
            if video_frames:
                for video_frame in video_frames:
                    video_data = convert_video_for_gemini(video_frame)
                    if video_data:
                        event_loop.call_soon_threadsafe(
                            lambda video_data=video_data: asyncio.run_coroutine_threadsafe(
                                video_queue.put(video_data), event_loop
                            )
                        )
            
            time.sleep(0.1)  # Kurze Pause zur CPU-Entlastung
    finally:
        # Cleanup
        if webrtc_ctx.state.playing:
            status_indicator.write("Verbindung wird geschlossen...")
            # Sende None, um die Schleifen zu beenden
            event_loop.call_soon_threadsafe(
                lambda: asyncio.run_coroutine_threadsafe(
                    audio_queue.put(None), event_loop
                )
            )
            event_loop.call_soon_threadsafe(
                lambda: asyncio.run_coroutine_threadsafe(
                    video_queue.put(None), event_loop
                )
            )
            gemini_thread.join(timeout=5)
            response_thread.join(timeout=5)
            event_loop.close()
            status_indicator.write("Verbindung geschlossen.")

if __name__ == "__main__":
    # Logging-Konfiguration
    logging.basicConfig(
        format="[%(asctime)s] %(levelname)7s from %(name)s in %(pathname)s:%(lineno)d: "
        "%(message)s",
        force=True,
    )
    
    DEBUG = os.environ.get("DEBUG", "false").lower() not in ["false", "no", "0"]
    logger.setLevel(level=logging.DEBUG if DEBUG else logging.INFO)
    
    st_webrtc_logger = logging.getLogger("streamlit_webrtc")
    st_webrtc_logger.setLevel(logging.DEBUG if DEBUG else logging.INFO)
    
    # Starten der App
    main()