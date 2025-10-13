import streamlit as st
from streamlit_webrtc import webrtc_streamer, WebRtcMode
import av
import queue
import threading
import asyncio
from google import genai

# import pyaudio
from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx
import time
import numpy as np
from scipy.signal import resample_poly
import logging
import matplotlib.pyplot as plt
import pydub
import traceback

# ⚙️ Logging-Konfiguration
logging.basicConfig(
    level=logging.INFO,  # INFO statt DEBUG → weniger Spam
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ⚙️ Audio / Gemini-Konfiguration
# FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
CHUNK_SIZE = 1024

MODEL = "models/gemini-live-2.5-flash-preview"
CONFIG = {
    "response_modalities": ["TEXT"],
    "system_instruction": "Du antwortest immer auf deutsch",
}


class GeminiAudioLoop:
    def __init__(self, recv_q, cmd_q, audio_q):
        self.recv_q = recv_q
        self.cmd_q = cmd_q
        self.audio_frame_queue = audio_q
        self.session = None

    async def run_session(self):
        """Starte Gemini-Session und Tasks für Audio/Command/Text."""
        client = genai.Client(
            http_options={"api_version": "v1beta"},
            api_key="AIzaSyBEr_QcXtn8qCdsZx52MpEyiL9gbu3Vaxs",
        )
        try:
            async with client.aio.live.connect(
                model=MODEL, config=CONFIG
            ) as session, asyncio.TaskGroup() as tg:
                self.session = session
                tg.create_task(self._send_audio_loop())
                tg.create_task(self._receive_text_loop())
                tg.create_task(self._receive_cmd_loop())
        except ExceptionGroup as EG:
            traceback.print_exception(EG)

    async def _send_audio_loop(self):
        logger.info("🎧 Audio send loop gestartet")

        while True:
            try:
                buffer = await asyncio.to_thread(self.audio_frame_queue.get)
                if buffer is None:
                    await asyncio.sleep(0.01)
                    continue

                pcm_bytes = buffer.astype("<i2").tobytes()
                await self.session.send(
                    input={"data": pcm_bytes, "mime_type": "audio/pcm;rate=16000"}
                )

            except queue.Empty:
                await asyncio.sleep(0.01)
            except Exception as e:
                logger.error(f"Error in send loop: {e}")
                await asyncio.sleep(0.1)

    async def _receive_text_loop(self):
        buffer = ""
        while True:
            async for resp in self.session.receive():
                if resp.text:
                    print(resp.text)
                    buffer += resp.text
                    if resp.text.endswith((".", "!", "?", ",")):
                        logger.info(f"Gemini sagt: {buffer}")
                        self.recv_q.put_nowait(buffer)
                        buffer = ""

    async def _receive_cmd_loop(self):
        while True:
            try:
                cmd = self.cmd_q.get_nowait()
                print(cmd)
            except queue.Empty:
                await asyncio.sleep(0.05)
            else:
                if cmd.startswith("Msg:"):
                    msg = cmd.replace("Msg:", "")
                    await self.session.send(input=msg or ".", end_of_turn=True)


def main():
    st.title("Gemini via WebRTC-Audio")

    if "messages" not in st.session_state:
        st.session_state.messages = []

    if "gemini_loop" not in st.session_state:
        st.session_state.gemini_loop = None
    if "recv_q" not in st.session_state:
        st.session_state.recv_q = queue.Queue()
    if "cmd_q" not in st.session_state:
        st.session_state.cmd_q = queue.Queue()
    if "audio_q" not in st.session_state:
        st.session_state.audio_q = queue.Queue()

    if st.session_state.gemini_loop is None:
        st.session_state.gemini_loop = GeminiAudioLoop(
            st.session_state.recv_q, st.session_state.cmd_q, st.session_state.audio_q
        )
        thread = threading.Thread(
            target=lambda: asyncio.run(st.session_state.gemini_loop.run_session()),
            daemon=True,
        )
        ctx = get_script_run_ctx()
        add_script_run_ctx(thread)
        thread.start()
        st.success("Gemini-Session gestartet")
        logger.info("Gemini-Session gestartet")

    webrtc_ctx = webrtc_streamer(
        key="audio",
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=1024,
        rtc_configuration={"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]},
        media_stream_constraints={"audio": True, "video": False},
        # async_processing=True,
    )

    def audio_put(audio_q, streamer):
        counter = 0
        jetzt = time.time()
        while streamer.audio_receiver is None:
            time.sleep(0.1)
        logger.info("Audio receiver ready ✅")
        while True:
            if streamer.audio_receiver:
                sound_chunk = pydub.AudioSegment.empty()
                try:
                    audio_frames = webrtc_ctx.audio_receiver.get_frames(timeout=1)
                except queue.Empty:
                    time.sleep(0.1)
                    continue

                for audio_frame in audio_frames:
                    sound = pydub.AudioSegment(
                        data=audio_frame.to_ndarray().tobytes(),
                        sample_width=audio_frame.format.bytes,
                        frame_rate=audio_frame.sample_rate,
                        channels=len(audio_frame.layout.channels),
                    )
                    sound_chunk += sound
                if len(sound_chunk) > 0:
                    sound_chunk = sound_chunk.set_channels(1).set_frame_rate(
                        SEND_SAMPLE_RATE
                    )
                    buffer = np.array(sound_chunk.get_array_of_samples())
                    audio_q.put_nowait((buffer))
            else:
                break

    if "audio_thread_running" not in st.session_state:
        logger.info("Audio receiver thread starting...")
        audio_thread = threading.Thread(
            target=audio_put, args=(st.session_state.audio_q, webrtc_ctx), daemon=True
        )
        audio_thread.start()
        st.session_state.audio_thread_running = True

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Nachricht an das Modell eingeben:"):
        st.session_state.cmd_q.put_nowait(f"Msg:{prompt}")
        print(f"Gesendet: {prompt}")
        # Display user message in chat message container
        with st.chat_message("user"):
            st.markdown(prompt)
        # Add user message to chat history
        st.session_state.messages.append({"role": "user", "content": prompt})

    @st.fragment(run_every="1s")
    def recive_fragment():
        print("#", end="")
        if st.session_state.recv_q.empty():
            return

        response = ""

        while not st.session_state.recv_q.empty():
            result = st.session_state.recv_q.get_nowait()
            response += result
            print(f"Result: {result}")

        with st.chat_message("assistant"):
            st.markdown(response)

        st.session_state.messages.append({"role": "assistant", "content": response})
        st.rerun()

    recive_fragment()

    logger.info("Streamlit UI ready.")


if __name__ == "__main__":
    main()
