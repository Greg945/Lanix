import asyncio
import pyaudio
from google import genai

# Für ältere Python-Versionen
if not hasattr(asyncio, 'TaskGroup'):
    import taskgroup, exceptiongroup
    asyncio.TaskGroup = taskgroup.TaskGroup
    asyncio.ExceptionGroup = exceptiongroup.ExceptionGroup

# Konfiguration
FORMAT, CHANNELS, RATE, CHUNK = pyaudio.paInt16, 1, 16000, 1024
MODEL = "models/gemini-2.0-flash-live-001"

# Client initialisieren
client = genai.Client(http_options={"api_version": "v1beta"}, api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")
pya = pyaudio.PyAudio()

async def main():
    try:
        # Audio-Komponenten einrichten
        audio_queue = asyncio.Queue(maxsize=5)
        audio_stream = pya.open(
            format=FORMAT, channels=CHANNELS, rate=RATE, input=True,
            input_device_index=pya.get_default_input_device_info()["index"],
            frames_per_buffer=CHUNK
        )
        
        # Gemini-Session starten
        async with client.aio.live.connect(
            model=MODEL, config={"response_modalities": ["TEXT"]}
        ) as session:
            async with asyncio.TaskGroup() as tg:
                # Audio-Erfassung und -Versand
                tg.create_task(capture_and_send_audio(audio_stream, audio_queue, session))
                # Text empfangen
                tg.create_task(receive_text(session))
                # Text-Eingabe verarbeiten (blockiert bis Benutzer "q" eingibt)
                await tg.create_task(handle_text_input(session))
                
    except asyncio.CancelledError:
        print("\nBeendigung durch Benutzer")
    except Exception as e:
        print(f"\nFehler: {e}")
    finally:
        if 'audio_stream' in locals():
            audio_stream.close()
        pya.terminate()

async def capture_and_send_audio(audio_stream, queue, session):
    """Audio aufnehmen und an Gemini senden"""
    kwargs = {"exception_on_overflow": False} if __debug__ else {}
    
    while True:
        # Audio aufnehmen
        data = await asyncio.to_thread(audio_stream.read, CHUNK, **kwargs)
        # An Gemini senden
        await session.send(input={"data": data, "mime_type": "audio/pcm"})

async def receive_text(session):
    """Antworten von Gemini empfangen und anzeigen"""
    while True:
        turn = session.receive()
        async for response in turn:
            if text := response.text:
                print(text, end="")

async def handle_text_input(session):
    """Benutzereingaben verarbeiten"""
    while True:
        text = await asyncio.to_thread(input, "Nachricht > ")
        if text.lower() == "q":
            raise asyncio.CancelledError("Benutzer hat Beendigung angefordert")
        await session.send(input=text or ".", end_of_turn=True)

if __name__ == "__main__":
    asyncio.run(main())