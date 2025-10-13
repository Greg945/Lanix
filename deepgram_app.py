import streamlit as st
from time import sleep
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch
import random
import json
import os
import threading
import csv
import datetime
import time

from streamlit_webrtc import webrtc_streamer


from streamlit.runtime.scriptrunner import add_script_run_ctx, get_script_run_ctx
from deepgram import (
    DeepgramClient,
    DeepgramClientOptions,
    LiveTranscriptionEvents,
    LiveOptions,
    Microphone,
)


client = genai.Client(api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")

google_search_tool = Tool(google_search=GoogleSearch())


if 'search' not in st.session_state:
    st.session_state.search = False


if "context" not in st.session_state:
    st.session_state.context = []

if "output" not in st.session_state:
    st.session_state.output = ""


DEFAULT_LANGUAGE = "de-DE"

# Systemanweisung für Gemini
SYS_INSTRUCT = ('Du bist ein mithörender Assistent in einem Klassenzimmer. Wenn du eine Frage hörst, beantworte sie bitte normal. '
                'Wenn es keine Frage ist, antworte nur mit "Ignoriert". Außerdem bekommst du immer den Konversationsverlauf, '
                'den du nur benutzt, falls du Informationen daraus zur Beantwortung der Frage brauchst.')


def lade_stundenplan(datei="stundenplan.csv"):
    stundenplan = []
    with open(datei, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            start = datetime.datetime.strptime(row["Start"], "%H:%M").time()
            ende = datetime.datetime.strptime(row["Ende"], "%H:%M").time()
            stundenplan.append({"Start": start, "Ende": ende, "Fach": row["Fach"], "Tag": row["Tag"]})
    return stundenplan

def aktuelles_fach():
    jetzt = datetime.datetime.now()
    aktueller_tag = jetzt.strftime("%A")
    aktuelle_zeit = jetzt.time()
    for eintrag in st.session_state.stundenplan:
        if eintrag["Tag"] == aktueller_tag and eintrag["Start"] <= aktuelle_zeit < eintrag["Ende"]:
            return eintrag["Fach"]
    return ""

if "stundenplan" not in st.session_state:
    st.session_state.stundenplan = lade_stundenplan()

def save_chat_history(context):
    print("week: ", datetime.date.today().isocalendar().week , " year: ", datetime.date.today().year)
    week_dir = "history/" + str(datetime.date.today().isocalendar().week)
    CHAT_FILE = week_dir + "/chat_history" + aktuelles_fach() + str(datetime.date.today()) + ".json"
    
    try:
        # Erstelle den history-Ordner, falls er nicht existiert
        if not os.path.exists("history"):
            os.makedirs("history")
            
        # Erstelle den Wochen-Ordner, falls er nicht existiert
        if not os.path.exists(week_dir):
            os.makedirs(week_dir)
            
        # Erstelle oder aktualisiere die JSON-Datei
        with open(CHAT_FILE, 'w', encoding='utf-8') as f:
            json.dump(context, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        st.error(f"Fehler beim Speichern des Chat-Verlaufs: {e}")

# def load_chat_history():
#     try:
#         if os.path.exists(CHAT_FILE):
#             with open(CHAT_FILE, 'r', encoding='utf-8') as f:
#                 return json.load(f)
#     except Exception as e:
#         st.error(f"Fehler beim Laden des Chat-Verlaufs: {e}")
#     return [{"role": "user", "content": "hallo"}]  # Standardwert falls keine Historie existiert

# def load_chat_history():
#     try:
#         with open(CHAT_FILE, "r") as f:
#             return json.load(f)
#     except FileNotFoundError:
#         return []

# def save_chat_history(chat_history):
#     with open(CHAT_FILE, "w") as f:
#         json.dump(chat_history, f)



def gemini_request(text):
    context = st.session_state.context
    search_enabled=st.session_state.get("search", False)
    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=GenerateContentConfig(
                system_instruction=SYS_INSTRUCT,
                tools=[google_search_tool] if search_enabled else [],
                response_modalities=["TEXT"]
            ),
            contents=f'Konversations Verlauf:"{context}" Das hier ist das gehörte im Klassenraum: {text}'
        )
        response_text = response.text.strip()
    except Exception as e:
        response_text = f"Fehler bei der API-Anfrage: {e}"
        st.error(response_text)

    st.session_state.context.append({"user": text, "assistant": response_text})

    save_chat_history(st.session_state.context)

    st.session_state.output = response_text
    print('Apicall for:', text)
    print(response_text)
    return response_text




def lang_switch():
    language_codes = {"Deutsch": "de-DE", "Englisch": "en-GB", "Französisch": "fr-FR"}
    if st.session_state.sprache != None:
        st.session_state.language_code = language_codes.get(st.session_state.sprache, DEFAULT_LANGUAGE)
    else:
        st.session_state.language_code = language_codes.get(aktuelles_fach(), DEFAULT_LANGUAGE)




# Deepgram API-Schlüssel (ersetzen Sie dies durch Ihren tatsächlichen Schlüssel)
DEEPGRAM_API_KEY = "861ef76d80da6f7535d9f3361dd139e2dd26a24d"

is_finals = []

def stt():
    try:
        # example of setting up a client config. logging values: WARNING, VERBOSE, DEBUG, SPAM
        # config = DeepgramClientOptions(
        #     verbose=verboselogs.DEBUG, options={"keepalive": "true"}
        # )
        # deepgram: DeepgramClient = DeepgramClient("", config)
        # otherwise, use default config
        config = DeepgramClientOptions(
        options={"keepalive": "true"}
        )
        deepgram: DeepgramClient = DeepgramClient(DEEPGRAM_API_KEY, config)

        dg_connection = deepgram.listen.websocket.v("1")
        ctx = get_script_run_ctx()

        

        def on_open(self, open, **kwargs):
            add_script_run_ctx(threading.current_thread(), ctx)
            print("Connection Open")
            st.info(
                "Use the 'Stop' button at the top right to stop transcription",
                icon="⏹️",
            )
            st.info("Starting transcription...")
            st.toast('This is a warning', icon="⚠️")

        def on_message(self, result, **kwargs):
            global is_finals
            output_box = st.empty()
            print("message")
            add_script_run_ctx(threading.current_thread(), ctx)
            sentence = result.channel.alternatives[0].transcript
            if len(sentence) == 0:
                return
            if len(sentence) > 0:
                st.text(sentence)
                print(sentence)
            if result.is_final:
                
                # We need to collect these and concatenate them together when we get a speech_final=true
                # See docs: https://developers.deepgram.com/docs/understand-endpointing-interim-results
                is_finals.append(sentence)
                # Speech Final means we have detected sufficient silence to consider this end of speech
                # Speech final is the lowest latency result as it triggers as soon an the endpointing value has triggered
                if result.speech_final:
                    utterance = " ".join(is_finals)
                    print(f"Speech Final: {utterance}")
                    st.write(f"Speech Final: {utterance}")
                    output_box.write(f"Antwort  auf text input:{gemini_request(utterance)}")
                    is_finals = []
                else:
                    # These are useful if you need real time captioning and update what the Interim Results produced
                    print(f"Is Final: {sentence}")
            else:
                # These are useful if you need real time captioning of what is being spoken
                print(f"Interim Results: {sentence}")


        def on_utterance_end(self, utterance_end, **kwargs):
            print("Utterance End")
            global is_finals
            if len(is_finals) > 0:
                utterance = " ".join(is_finals)
                print(f"Utterance End: {utterance}")
                is_finals = []

        def on_close(self, close, **kwargs):
            print("Connection Closed")

        def on_error(self, error, **kwargs):
            print(f"Handled Error: {error}")

        def on_unhandled(self, unhandled, **kwargs):
            print(f"Unhandled Websocket Message: {unhandled}")

        dg_connection.on(LiveTranscriptionEvents.Open, on_open)
        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.UtteranceEnd, on_utterance_end)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)
        dg_connection.on(LiveTranscriptionEvents.Unhandled, on_unhandled)

        options: LiveOptions = LiveOptions(
            model="nova-2",
            language=st.session_state.language_code,
            diarize=True,
            # Apply smart formatting to the output
            smart_format=True,
            # Raw audio format details
            encoding="linear16",
            channels=1,
            sample_rate=16000,
            # # To get UtteranceEnd, the following must be set:
            # interim_results=True,
            # utterance_end_ms="1000",
            # vad_events=True,
            # Time in milliseconds of silence to wait for before finalizing speech
            endpointing=300,
        )

        addons = {
            # Prevent waiting for additional numbers
            "no_delay": "true"
        }

        print("\n\nPress Enter to stop recording...\n\n")
        if dg_connection.start(options, addons=addons) is False:
            print("Failed to connect to Deepgram")
            return
        
        webrtc_ctx = webrtc_streamer(
            key="speech-to-text",
            #mode=WebRtcMode.SENDONLY,
            #audio_receiver_size=1024,
            audio_frame_callback=dg_connection.send,
            media_stream_constraints={"video": False, "audio": True},
        )

        # Open a microphone stream on the default input device
        #microphone = Microphone(dg_connection.send)

        # start microphone
        #microphone.start()


        input("")

        # # wait until finished
        if st.button("STT Stop"):
            
            # Wait for the microphone to close
            microphone.finish()

            # Indicate that we've finished
            dg_connection.finish()

            
            print("Finished")
            st.success("Finished")
            # sleep(30)  # wait 30 seconds to see if there is any additional socket activity
            # print("Really done!")

    except Exception as e:
        print(f"Could not open socket: {e}")
        return



settings = st.Page("seiten/settings.py", title="Settings", icon=":material/settings:")
photo = st.Page("seiten/settings.py", title="Photo", icon=":material/camera:")
stg = st.Page("seiten/stg.py", title="STG", icon=":material/camera:")

st.logo("images/horizontal_blue.png", icon_image="images/icon_blue.png")

pg = st.navigation(["seiten/stg.py", "seiten/settings.py", "seiten/photo.py"])
pg.run()


st.title("STG")


st.selectbox("Sprache",("Deutsch", "Englisch", "Französisch"), key="sprache", index=None, on_change=lang_switch, placeholder="Default: Automatic")


if st.button("STT Start"):
    lang_switch()
    stt()

st.text_area(f"Antwort  auf text input:{st.session_state.output}", height=100, value=st.session_state.output)


text_input = st.text_input("Oder Eingabe per Tastatur", key="text_input")

if st.button("Senden"):
    if text_input:
        st.text_area(f"Antwort  auf text input:{gemini_request(text_input)}", height=100)
        


if st.button("Clear Session State"):
    for key in st.session_state.keys():
        del st.session_state[key]
    st.rerun()

st.checkbox("Google-Suche aktivieren", key="search")

if st.button("Zufällige Frage testen"):
    test_prompts = ["Apfel", "Was ist die Hauptstadt von Berlin?", "Kirsche", "Hallo", "Wie hoch ist der Eiffelturm"]
    value = random.choice(test_prompts)
    st.write("Received", value)
    st.text_area(f"Antwort  auf text input:{gemini_request(value)}", height=100)


st.link_button("Close", "https://login.schulportal.hessen.de/?url=aHR0cHM6Ly9jb25uZWN0LnNjaHVscG9ydGFsLmhlc3Nlbi5kZS8=&skin=sp&i=5120")

if st.checkbox("Verlauf anzeigen"):
    st.text_area("Konversationsverlauf:", value=str(st.session_state.context), height=200)

if st.button("Session State"):
    st.write(st.session_state)
