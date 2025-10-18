import streamlit as st
from streamlit_webrtc import webrtc_streamer, WebRtcMode
from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx

from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch, Part

import random
import json
from pathlib import Path
import csv

import threading
import asyncio
import queue

import datetime
import time

import PIL
import io
import os
import sys
import av

import base64
import matplotlib.pyplot as plt
import pydub
from scipy.signal import resample_poly
import numpy as np

import traceback
import logging

# ⚙️ Logging-Konfiguration
logging.basicConfig(
    level=logging.INFO,  # INFO statt DEBUG → weniger Spam
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

#############################################################################################
# Variablen #

google_search_tool = Tool(google_search=GoogleSearch())

CHANNELS = 1
SEND_SAMPLE_RATE = 16000
CHUNK_SIZE = 1024

MODEL = "models/gemini-live-2.5-flash-preview"
CONFIG = {
    "response_modalities": ["TEXT"],
    "system_instruction": "Du antwortest immer auf deutsch",
}

client = genai.Client(
    http_options={"api_version": "v1beta"},
    api_key=st.secrets["GOOGLE_API_KEY"],
)

st.session_state.aaatest_page = "WORKS"

if "search" not in st.session_state:
    st.session_state.search = False

# if 'test' not in st.session_state:
#    st.session_state.test = "1"

if "context" not in st.session_state:
    st.session_state.context = []

if "prompt" not in st.session_state:
    st.session_state.prompt = ""

if "config_loaded" not in st.session_state:
    st.session_state.config_loaded = False

if "config_name_input" not in st.session_state:
    st.session_state.config_name_input = "default_config"

if "config_selector" not in st.session_state:
    st.session_state.config_selector = st.session_state.config_name_input

if "expander_state" not in st.session_state:
    st.session_state.expander_state = False

if "context_open" not in st.session_state:
    st.session_state.context_open = False
    print("falssseeee")

if "gemini_loop" not in st.session_state:
    st.session_state.gemini_loop = None

if "recv_q" not in st.session_state:
    st.session_state.recv_q = queue.Queue()

if "cmd_q" not in st.session_state:
    st.session_state.cmd_q = queue.Queue()

if "audio_q" not in st.session_state:
    st.session_state.audio_q = queue.Queue()

if "messages" not in st.session_state:
    st.session_state.messages = []

#####################################################################################
# Definitionen #


def load_config(config_name=None):
    if config_name is None:
        config_name = st.session_state.config_selector
    print("Config laden:", config_name)
    with open("configs/" + config_name + ".json", "r", encoding="utf-8") as f:
        config_data = json.load(f)

        # Setze die Werte im Session State
        if "system_prompt" in config_data:
            st.session_state.config_sys_prompt = config_data["system_prompt"]
        else:
            st.session_state.config_sys_prompt = 'Du bist ein mithörender Assistent in einem Klassenzimmer. Wenn du eine Frage hörst, beantworte sie bitte normal. Wenn es keine Frage ist, antworte nur mit "Ignoriert". Außerdem bekommst du immer den Konversationsverlauf, den du nur benutzt, falls du Informationen daraus zur Beantwortung der Frage brauchst.'

        if "volume" in config_data:
            st.session_state.config_volume = config_data["volume"]
        else:
            st.session_state.config_volume = 100

        if "stundenplan" in config_data:
            st.session_state.stundenplan = config_data["stundenplan"]
        else:
            st.session_state.stundenplan = lade_stundenplan()

        st.session_state.config_loaded = True
        st.session_state.config_name_input = config_name


def lade_stundenplan(datei="stundenplan2.csv"):
    stundenplan = []
    with open(datei, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            stundenplan.append(row)
    return stundenplan


def aktuelles_fach():
    jetzt = datetime.datetime.now()
    # Konvertiere den aktuellen Tag in das englische Format (für die JSON-Struktur)
    aktueller_tag = jetzt.strftime("%A")  # Gibt "Monday", "Tuesday", etc. zurück
    aktuelle_zeit = jetzt.time()

    # Konvertiere die aktuelle Zeit in ein Format, das mit dem Stundenplan verglichen werden kann
    aktuelle_zeit_str = aktuelle_zeit.strftime("%H:%M")

    # Durchsuche den Stundenplan nach dem aktuellen Fach
    for eintrag in st.session_state.stundenplan:
        start_zeit = eintrag["Start"]
        ende_zeit = eintrag["Ende"]

        # Prüfe, ob die aktuelle Zeit zwischen Start und Ende liegt
        if start_zeit <= aktuelle_zeit_str <= ende_zeit:
            # Gib das Fach für den aktuellen Tag zurück
            return eintrag.get(aktueller_tag, "")

    return ""  # Falls kein Fach gefunden wird


# Stundenplan wird jetzt direkt aus der Konfiguration geladen
# if "stundenplan" not in st.session_state:
#     st.session_state.stundenplan = lade_stundenplan()


def save_chat_history():
    print(
        "week: ",
        datetime.date.today().isocalendar().week,
        " year: ",
        datetime.date.today().year,
    )
    week_dir = "history/" + str(datetime.date.today().isocalendar().week)
    CHAT_FILE = (
        week_dir
        + "/chat_history"
        + aktuelles_fach()
        + str(datetime.date.today())
        + ".json"
    )

    context = []
    for message in st.session_state.context:
        message_dict = {
            "time": message.get("time"),
            "user": message.get("user"),
            "assistant": message.get("assistant"),
        }
        if "file" in message:
            # Konvertiere die Bilder in Base64
            message_dict["file"] = []
            for image in message["file"]:
                buffer = io.BytesIO()
                image.save(buffer, format="JPEG")
                base64_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
                message_dict["file"].append(base64_image)
        context.append(message_dict)
    print(context)

    try:
        # Erstelle den history-Ordner, falls er nicht existiert
        if not os.path.exists("history"):
            os.makedirs("history")

        # Erstelle den Wochen-Ordner, falls er nicht existiert
        if not os.path.exists(week_dir):
            os.makedirs(week_dir)

        # Erstelle oder aktualisiere die JSON-Datei
        with open(CHAT_FILE, "w", encoding="utf-8") as f:
            json.dump(context, f, ensure_ascii=False, indent=2)

    except Exception as e:
        st.error(f"Fehler beim Speichern des Chat-Verlaufs: {e}")


def load_chat_history():
    start_folder_path = Path("history")
    search_term = "mathe"

    print(
        f"Durchsuche Ordner '{start_folder_path}' und Unterordner nach Dateien mit '{search_term}' im Namen..."
    )
    matching_files = []
    try:
        for dirpath, dirnames, filenames in os.walk(start_folder_path):
            current_dir_path = Path(dirpath)
            for filename in filenames:
                if search_term.lower() in filename.lower():
                    full_path = current_dir_path / filename
                    matching_files.append(full_path)

        if not matching_files:
            print(
                f"\nKeine Dateien mit '{search_term}' im Namen im Ordner '{start_folder_path}' oder seinen Unterordnern gefunden."
            )
        else:
            newest_file = max(matching_files, key=lambda f: f.stat().st_mtime)
            print(
                f"\nDie neuste Datei mit '{search_term}' im Namen (inkl. Unterordner) ist:"
            )
            print(newest_file)
    except OSError as e:
        print(f"\nFehler beim Zugriff auf den Ordner oder die Dateien: {e}")
        st.error(f"\nFehler beim Zugriff auf den Ordner oder die Dateien: {e}")
    except Exception as e:
        print(f"\nEin unerwarteter Fehler ist aufgetreten: {e}")
        st.error(f"\nEin unerwarteter Fehler ist aufgetreten: {e}")

    try:
        with open(newest_file.resolve(), "r", encoding="utf-8") as f:
            letzte_stunde_history = json.load(f)

            # Konvertiere Base64-Bilder zurück in PIL-Images
            for message in letzte_stunde_history:
                if "file" in message:
                    message["file"] = [
                        PIL.Image.open(io.BytesIO(base64.b64decode(img)))
                        for img in message["file"]
                    ]

    except Exception as e:
        st.error(f"Fehler beim Laden des Chat-Verlaufs: {e}")
    print(letzte_stunde_history)

    gemini_request(letzte_stunde_history, "summary")


class GeminiAudioLoop:
    def __init__(self, recv_q, cmd_q, audio_q):
        self.recv_q = recv_q
        self.cmd_q = cmd_q
        self.audio_frame_queue = audio_q
        self.session = None

    async def run_session(self):
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


def audio_put(audio_q, streamer):
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


def start_audio_processor_thread():
    logger.info("Audio receiver thread starting...")
    audio_thread = threading.Thread(
        target=audio_put, args=(st.session_state.audio_q, webrtc_ctx), daemon=True
    )
    audio_thread.start()
    st.session_state.audio_thread_running = True


def start_gemini_loop():
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


##################################  UI  #########################################
st.write("#")
st.title("STG")

config_files = []
if os.path.exists("configs"):
    config_files = [
        f.replace(".json", "") for f in os.listdir("configs") if f.endswith(".json")
    ]
    if not config_files:  # Wenn keine Konfigurationen gefunden wurden
        st.error("No Configuration Found")

# Selectbox für Konfigurationsauswahl
selected_config = st.selectbox(
    "Load Config",
    config_files,
    placeholder="Automatisch: Default Config",
    key="config_selector",
    on_change=load_config,
)
print(selected_config)
if selected_config:
    print("true")

if not st.session_state.config_loaded:
    load_config("default_config")

if st.button("letzte stunde"):
    load_chat_history()

if st.toggle("STT?"):
    print(
        st.session_state.config_model,
        st.session_state.config_volume,
    )
    webrtc_ctx = webrtc_streamer(
        key="audio",
        mode=WebRtcMode.SENDONLY,
        audio_receiver_size=1024,
        rtc_configuration={"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]},
        media_stream_constraints={"audio": True, "video": False},
        # async_processing=True,
    )
    if "audio_thread_running" not in st.session_state:
        start_audio_processor_thread()

    if "gemini_loop" not in st.session_state:
        start_gemini_loop()

chat_box = st.container(height=300)
with chat_box:
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])
            if "file" in message:
                for image in message["file"]:
                    st.image(image)

if prompt := st.chat_input(
    "Say something",
    accept_file="multiple",
    file_type=["jpg", "jpeg", "png", "pdf"],
):
    with chat_box:
        if st.session_state.prompt != "":
            user_text = st.session_state.prompt
        else:
            user_text = prompt.text
        if prompt.files:
            file_names = ", ".join([f.name for f in prompt.files])
            user_text += f" (Dateien: {file_names})"
        st.chat_message("user").write(user_text)

        if not prompt.files:
            st.session_state.cmd_q.put_nowait(f"Msg:{user_text}")
            st.session_state.messages.append({"role": "user", "content": user_text})
        else:
            print("File Uploads noch nicht möglich")
            st.warning("File Uploads noch nicht möglich")
            for file in prompt.files:
                if file.type.startswith("image/"):
                    st.image(file)
            st.session_state.messages.append(
                {"role": "user", "content": user_text, "file": prompt.files}
            )

recive_fragment()

# photo_expander = st.popover("Photo Prompt")
#
# with photo_expander:
if st.checkbox("Photo prompt"):
    if "single" not in st.session_state:
        st.session_state.single = 1
    if "min" not in st.session_state:
        st.session_state.min = 1
    if "max" not in st.session_state:
        st.session_state.max = 2
    if "aufgaben" not in st.session_state:
        st.session_state.aufgaben = "Alle auf dem Foto"
    if "words_radio" not in st.session_state:
        st.session_state.words_radio = ""

    prompt = "Beantworte auf diesem Bild Aufgabe: "

    num_dict = {
        17: 0,
        1: 1,
        7: 2,
        8: 2,
        9: 2,
    }

    prompt += st.radio(
        "Beantworte Aufgabe",
        [
            "Alle auf dem Foto",
            str(st.number_input("Specific Nummer", 1, step=1, key="single")),
            str(st.number_input("Min Nummer", 1, step=1, key="min"))
            + " bis "
            + str(
                st.number_input(
                    "Max Nummer", st.session_state.min + 1, step=1, key="max"
                )
            ),
        ],
        num_dict[len(st.session_state.aufgaben)],
        key="aufgaben",
    )

    word_dict = {
        0: 0,
        14: 1,
        15: 1,
        16: 1,
    }
    prompt += " " + st.radio(
        "Wörter",
        [
            "",
            "in "
            + str(st.number_input("Anzahl Wörtern", 0, value=100, step=25, key="words"))
            + " Wörtern ",
        ],
        word_dict[len(st.session_state.words_radio)],
        key="words_radio",
    )

    prompt += st.radio(
        "Textsorte",
        [
            "",
            "in Stichpunkten ",
            "als Fließtext ",
            "in " + st.text_input("Custom Type"),
        ],
    )

    prompt += " in leichter Sprache " if st.checkbox("in leichter Sprache") else ""
    prompt += " in " + st.selectbox(
        "Sprache", ("Deutsch", "Englisch", "Französisch", "Spanisch")
    )

    st.write("Prompt:", prompt)

    st.session_state.prompt = prompt
    # print("lol")
else:
    st.session_state.prompt = ""

# print(photo_expander)
# else:
#    st.session_state.prompt = ""


if st.button("Clear Session State"):
    for key in st.session_state.keys():
        del st.session_state[key]
    st.rerun()

st.checkbox("Google-Suche aktivieren", key="search")

if st.button("Zufällige Frage testen"):
    test_prompts = [
        "Apfel",
        "Was ist die Hauptstadt von Berlin?",
        "Kirsche",
        "Hallo",
        "Wie hoch ist der Eiffelturm",
    ]
    value = random.choice(test_prompts)
    st.write("Received", value)
    st.text_area(f"Antwort  auf random:", gemini_request(value), height=100)

if st.checkbox("Verlauf anzeigen"):
    st.text_area(
        "Konversationsverlauf:", value=str(st.session_state.context), height=200
    )

logger.info("Streamlit UI ready.")
