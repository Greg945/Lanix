"""
Google Generative AI Live Chat Script

Setup:
To install the dependencies for this script, run:
    pip install google-genai pyaudio

Before running, set your Google AI Studio API key as an environment variable:
    export GOOGLE_API_KEY='your_api_key_here'

Run the script:
    python live_genai_chat.py
"""


import asyncio
import pyaudio
from google import genai
import traceback
import streamlit as st
from streamlit_webrtc import WebRtcMode, webrtc_streamer

st.header("Gemini Live Test")
# Configuration
MODEL = "models/gemini-2.0-flash-live-001"
FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

client = genai.Client(http_options={"api_version": "v1beta"}, api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")
pya = pyaudio.PyAudio()

config = {"response_modalities": ["TEXT"]}

webrtc_ctx = webrtc_streamer(
    key="speech-to-text",
    mode=WebRtcMode.SENDONLY,
    audio_receiver_size=1024,
    media_stream_constraints={"video": False, "audio": True},
)
print("Webrtc_ctx: ", webrtc_ctx)


class LiveAIChat:
    def __init__(self):
        # Queues for async communication
        self.out_queue = None
        self.audio_in_queue = None
        
        # Session will be set when connection is established
        self.session = None

        self.waiting_for_response = False
    async def send_text(self):
        while True:
            text = await asyncio.to_thread(
                input,
                "message > ",
            )
            if text.lower() == "q":
                break

            self.waiting_for_response = True
            await self.session.send(input=text or ".", end_of_turn=True)

            while self.waiting_for_response:
                await asyncio.sleep(0.1)

    async def receive_text(self):
        async for response in self.session.receive():
            if response.text:
                print(response.text, end="")       

    async def send_realtime(self):
        while True:
            msg = await self.out_queue.get()
            if not self.waiting_for_response:
                await self.session.send(input=msg)

    async def listen_audio(self):
        
        if webrtc_ctx.state.playing:
            print("WebRTC Verbindung hergestellt und Audio wird empfangen")

            # Audio-Frames verarbeiten
            while webrtc_ctx.state.playing:
                if webrtc_ctx.audio_receiver:
                    try:
                        # Frames vom WebRTC-Receiver holen
                        audio_frames = webrtc_ctx.audio_receiver.get_frames(timeout=1)

                        if not audio_frames:
                            await asyncio.sleep(0.01)
                            continue

                        for audio_frame in audio_frames:
                            # Audio-Daten extrahieren und in das richtige Format konvertieren
                            sound_data = audio_frame.to_ndarray()

                            # PCM-Daten in Bytes umwandeln
                            pcm_data = sound_data.tobytes()
                            #print(pcm_data)

                            # In die Ausgabe-Queue legen, wie bei PyAudio
                            await self.out_queue.put({"data": pcm_data, "mime_type": "audio/pcm"})

                    except self.queue.Empty:
                        # Keine Frames verfügbar, kurz warten
                        await asyncio.sleep(0.01)
                else:
                    await asyncio.sleep(0.1)
        else:
            # Wenn WebRTC nicht aktiv ist, kurz warten und erneut prüfen
            await asyncio.sleep(0.1)

        # mic_info = pya.get_default_input_device_info()
        # self.audio_stream = await asyncio.to_thread(
            # pya.open,
            # format=FORMAT,
            # channels=CHANNELS,
            # rate=SEND_SAMPLE_RATE,
            # input=True,
            # input_device_index=mic_info["index"],
            # frames_per_buffer=CHUNK_SIZE,
        # )
        # print(self.audio_stream.read)
        # if __debug__:
            # kwargs = {"exception_on_overflow": False}
        # else:
            # kwargs = {}
        # while True:
            # data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
            # await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})

        # self.webrtc_ctx = webrtc_streamer(
        # key="speech-to-text",
        # mode=WebRtcMode.SENDONLY,
        # audio_receiver_size=1024,
        # media_stream_constraints={"video": False, "audio": True},
        # )

        # print("Webrtc_ctx: ", self.webrtc_ctx)

        # mic_info = pya.get_default_input_device_info()
        # self.audio_stream = await asyncio.to_thread(
        #     pya.open,
        #     format=FORMAT,
        #     channels=CHANNELS,
        #     rate=SEND_SAMPLE_RATE,
        #     input=True,
        #     input_device_index=mic_info["index"],
        #     frames_per_buffer=CHUNK_SIZE,
        # )
        # print(self.audio_stream.read)
        # if __debug__:
        #     kwargs = {"exception_on_overflow": False}
        # else:
        #     kwargs = {}
        # while True:
        #     data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
        #     await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})

    async def continuous_response_listener(self):
        """Diese neue Task hört kontinuierlich auf Antworten vom Modell"""
        while True:
            try:
                async for response in self.session.receive():
                    if response.text:
                        print(response.text, end="", flush=True)
                    if response.data:
                        self.audio_in_queue.put_nowait(response.data)
                    
                    # Wenn ein end_of_turn erreicht ist, setze die Flag zurück
                    if hasattr(response, 'end_of_turn') and response.end_of_turn:
                        self.waiting_for_response = False
                        print("\n")  # Neue Zeile für bessere Lesbarkeit
            except Exception as e:
                print(f"Fehler beim Empfangen der Antwort: {e}")
                self.waiting_for_response = False
                await asyncio.sleep(1)

    async def receive_audio(self):
        "Background task to reads from the websocket and write pcm chunks to the output queue"
        while True:
            turn = self.session.receive()
            async for response in turn:
                if data := response.data:
                    self.audio_in_queue.put_nowait(data)
                    continue
                if text := response.text:
                    print(text, end="")

            while not self.audio_in_queue.empty():
                self.audio_in_queue.get_nowait()

    async def play_audio(self):
        stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=RECEIVE_SAMPLE_RATE,
            output=True,
        )
        while True:
            bytestream = await self.audio_in_queue.get()
            await asyncio.to_thread(stream.write, bytestream)

    async def run(self):
        try:
            async with (
                client.aio.live.connect(model=MODEL, config=config) as session,
                asyncio.TaskGroup() as tg,
            ):
                self.session = session
                
                self.audio_in_queue = asyncio.Queue()
                self.out_queue = asyncio.Queue(maxsize=5)

                
                send_text_task = tg.create_task(self.send_text())
                tg.create_task(self.send_realtime())
                tg.create_task(self.listen_audio())

                #tg.create_task(self.receive_audio())
                tg.create_task(self.play_audio())
                tg.create_task(self.continuous_response_listener())
                #tg.create_task(self.receive_text())

                await send_text_task
                raise asyncio.CancelledError("User requested exit")

        except asyncio.CancelledError:
            pass
        except ExceptionGroup as EG:
            #self.audio_stream.close()
            traceback.print_exception(EG)


    

if __name__ == "__main__":
    try:
        chat = LiveAIChat()
        asyncio.run(chat.run())
    except KeyboardInterrupt:
        print("\nChat terminated by user.")
    except Exception as e:
        print(f"Unexpected error: {e}")