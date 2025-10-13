# -*- coding: utf-8 -*-
# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
## Setup

To install the dependencies for this script, run:

``` 
pip install google-genai opencv-python pyaudio pillow mss
```

Before running this script, ensure the `GOOGLE_API_KEY` environment
variable is set to the api-key you obtained from Google AI Studio.

Important: **Use headphones**. This script uses the system default audio
input and output, which often won't include echo cancellation. So to prevent
the model from interrupting itself it is important that you use headphones. 

## Run

To run the script:

```
python Get_started_LiveAPI.py
```

The script takes a video-mode flag `--mode`, this can be "camera", "screen", or "none".
The default is "camera". To share your screen run:

```
python Get_started_LiveAPI.py --mode screen
```
"""

import asyncio
import traceback
import pyaudio
from google import genai

FORMAT = pyaudio.paInt16
CHANNELS = 1
SEND_SAMPLE_RATE = 16000
RECEIVE_SAMPLE_RATE = 24000
CHUNK_SIZE = 1024

MODEL = "models/gemini-2.0-flash-live-001"


client = genai.Client(http_options={"api_version": "v1beta"}, api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")

CONFIG = {"response_modalities": ["TEXT"]}

pya = pyaudio.PyAudio()


# class AudioLoop:
#     def __init__(self):

#         self.audio_in_queue = None
#         self.out_queue = None

#         self.session = None

#         self.send_text_task = None

#     async def send_text(self):
#         while True:
#             text = await asyncio.to_thread(
#                 input,
#                 "message > ",
#             )
#             if text.lower() == "q":
#                 break
#             await self.session.send(input=text or ".", end_of_turn=True)

#     async def send_realtime(self):
#         while True:
#             msg = await self.out_queue.get()
#             await self.session.send(input=msg)

#     async def listen_audio(self):
#         mic_info = pya.get_default_input_device_info()
#         self.audio_stream = await asyncio.to_thread(
#             pya.open,
#             format=FORMAT,
#             channels=CHANNELS,
#             rate=SEND_SAMPLE_RATE,
#             input=True,
#             input_device_index=mic_info["index"],
#             frames_per_buffer=CHUNK_SIZE,
#         )
#         if __debug__:
#             kwargs = {"exception_on_overflow": False}
#         else:
#             kwargs = {}
#         while True:
#             data = await asyncio.to_thread(self.audio_stream.read, CHUNK_SIZE, **kwargs)
#             #print(data, "\n\n\n\n\n\n\n\n\n\n\n\n")
#             await self.out_queue.put({"data": data, "mime_type": "audio/pcm"})

#     async def receive_audio(self):
#         "Background task to reads from the websocket and write pcm chunks to the output queue"
#         while True:
#             turn = self.session.receive()
#             async for response in turn:
#                 if data := response.data:
#                     self.audio_in_queue.put_nowait(data)
#                     continue
#                 if text := response.text:
#                     print(text, end="")

#             # If you interrupt the model, it sends a turn_complete.
#             # For interruptions to work, we need to stop playback.
#             # So empty out the audio queue because it may have loaded
#             # much more audio than has played yet.
#             while not self.audio_in_queue.empty():
#                 self.audio_in_queue.get_nowait()

#     async def run(self):
#         try:
#             async with (
#                 client.aio.live.connect(model=MODEL, config=CONFIG) as session,
#                 asyncio.TaskGroup() as tg,
#             ):
#                 self.session = session

#                 self.audio_in_queue = asyncio.Queue()
#                 self.out_queue = asyncio.Queue(maxsize=5)

#                 send_text_task = tg.create_task(self.send_text())
#                 tg.create_task(self.send_realtime())
#                 tg.create_task(self.listen_audio())
#                 tg.create_task(self.receive_audio())

#                 await send_text_task
#                 raise asyncio.CancelledError("User requested exit")

#         except asyncio.CancelledError:
#             pass
#         except ExceptionGroup as EG:
#             self.audio_stream.close()
#             traceback.print_exception(EG)

# session = None
# out_queue = None
# send_text_task = None



# mic_info = pya.get_default_input_device_info()
# audio_stream = asyncio.to_thread(
#    pya.open,
#    format=FORMAT,
#    channels=CHANNELS,
#    rate=SEND_SAMPLE_RATE,
#    input=True,
#    input_device_index=mic_info["index"],
#    frames_per_buffer=CHUNK_SIZE,
# )
# if __debug__:
#    kwargs = {"exception_on_overflow": False}
# else:
#    kwargs = {}
   
# with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
#    while True:
#        if text := input:
#            print("message > ", text)
#        if text.lower() == "q":
#            break
#        session.send(input=text or ".", end_of_turn=True)
#        data = asyncio.to_thread(audio_stream.read, CHUNK_SIZE, **kwargs)
#        out_queue.put({"data": data, "mime_type": "audio/pcm"})

#        turn = session.receive()
#        for response in turn:
#            if text := response.text:
#                    print(text, end="")

async def main():
    try:
        mic_info = pya.get_default_input_device_info()
        audio_stream = await asyncio.to_thread(
            pya.open,
            format=FORMAT,
            channels=CHANNELS,
            rate=SEND_SAMPLE_RATE,
            input=True,
            input_device_index=mic_info["index"],
            frames_per_buffer=CHUNK_SIZE,
        )
        
        if __debug__:
            kwargs = {"exception_on_overflow": False}
        else:
            kwargs = {}
            
        async with client.aio.live.connect(model=MODEL, config=CONFIG) as session:
            print("Mikrofon ist aktiv. Drücken Sie 'q' zum Beenden.")
            
            while True:
                # Kontinuierliche Audioaufnahme
                data = await asyncio.to_thread(audio_stream.read, CHUNK_SIZE, **kwargs)
                if data:
                    await session.send(input={"data": data, "mime_type": "audio/pcm"})
                
                # Überprüfen auf Benutzereingabe
                if asyncio.get_event_loop().is_running():
                    try:
                        text = await asyncio.get_event_loop().run_in_executor(None, input, "message > ")
                        if text.lower() == "q":
                            break
                        if text.strip():
                            await session.send(input=text, end_of_turn=True)
                    except EOFError:
                        break

                async for response in session.receive():
                    if ausgabe := response.text:
                        print(ausgabe, end="")
                        
    except Exception as e:
        print(f"Ein Fehler ist aufgetreten: {e}")
        traceback.print_exception(type(e), e, e.__traceback__)
    finally:
        if 'audio_stream' in locals():
            audio_stream.close()
            pya.terminate()

if __name__ == "__main__":
    asyncio.run(main())