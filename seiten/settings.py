import streamlit as st
import json
import pandas as pd
import datetime
import csv
import os



#if 'config_name_input' not in st.session_state:
#    st.session_state.config_name_input = "Config"

#st.session_state.config_selector = st.session_state.config_selector

print(st.session_state)

if "config_name_input" not in st.session_state:
    st.session_state.config_name_input= "default_config"

if "config_selector" not in st.session_state:
    st.session_state.config_selector = st.session_state.config_name_input

st.header("Settings")

st.write("Einstellungen")

# Lade alle verfügbaren Konfigurationen aus dem configs Ordner
config_files = []
if os.path.exists("configs"):
    config_files = [f.replace(".json", "") for f in os.listdir("configs") if f.endswith(".json")]
    if not config_files:  # Wenn keine Konfigurationen gefunden wurden
        config_files = ["Neue Konfiguration"]

# Selectbox für Konfigurationsauswahl
selected_config = st.selectbox(
    "Load Config",
    config_files,
    key="config_selector"
)

# Wenn eine Konfiguration ausgewählt wurde, setze den Namen
if selected_config != "Neue Konfiguration":
    st.session_state.config_name_input = selected_config

# Lade die JSON-Datei und extrahiere den Stundenplan
try:
    with open("configs/" + st.session_state.config_name_input + ".json", "r", encoding="utf-8") as f:
        data = json.load(f)
        if "stundenplan" in data:
            df = pd.DataFrame(data["stundenplan"])
        else:
            # Fallback, falls die Datei noch nicht die neue Struktur hat
            df = pd.DataFrame(data)
except FileNotFoundError:
    # Fallback auf CSV, falls JSON noch nicht existiert
    df = pd.read_csv("stundenplan2.csv")

edited_df = st.data_editor(
    df,
    column_config={},
    num_rows="dynamic"
)


def save_json():
    print("Aufgreufen")
    # Konvertiere DataFrame zu JSON
    json_data = edited_df.to_json(orient='records', force_ascii=False)
    
    # Erstelle die neue Struktur mit allen Einstellungen
    full_data = {
        "stundenplan": json.loads(json_data),
        "deepgram_model": st.session_state.config_model,
        "system_prompt": st.session_state.config_sys_prompt,
        "diarize": st.session_state.config_diarize_toggle,
        "endpointing": st.session_state.config_endpointing,
        "volume": st.session_state.config_volume
    }
    print(full_data)
    
    # Stelle sicher, dass der configs Ordner existiert
    os.makedirs("configs", exist_ok=True)
    
    # Speichere JSON in Datei (überschreibt existierende Datei)
    with open("configs/" + st.session_state.config_name_input + ".json", "w", encoding="utf-8") as f:
        json.dump(full_data, f, indent=2, ensure_ascii=False)
    
    # Aktualisiere die Liste der verfügbaren Konfigurationen
    if st.session_state.config_name_input not in config_files:
        config_files.append(st.session_state.config_name_input)
    
    st.success(f"Konfiguration '{st.session_state.config_name_input}' wurde gespeichert!")
    
    print(json.dumps(full_data, indent=2, ensure_ascii=False))


# Lade gespeicherte Werte für die Eingabefelder
try:
    with open("configs/" + st.session_state.config_name_input + ".json", "r", encoding="utf-8") as f:
        data = json.load(f)
        default_model = data.get("deepgram_model", "nova-2")
        default_prompt = data.get("system_prompt", 'Du bist ein mithörender Assistent in einem Klassenzimmer. Wenn du eine Frage hörst, beantworte sie bitte normal. Wenn es keine Frage ist, antworte nur mit "Ignoriert". Außerdem bekommst du immer den Konversationsverlauf, den du nur benutzt, falls du Informationen daraus zur Beantwortung der Frage brauchst.')
        default_diarize = data.get("diarize", False)
        default_endpointing = data.get("endpointing", False)
        default_volume = data.get("volume", 100)
except FileNotFoundError:
    default_model = "nova-2"
    default_prompt = 'Du bist ein mithörender Assistent in einem Klassenzimmer. Wenn du eine Frage hörst, beantworte sie bitte normal. Wenn es keine Frage ist, antworte nur mit "Ignoriert". Außerdem bekommst du immer den Konversationsverlauf, den du nur benutzt, falls du Informationen daraus zur Beantwortung der Frage braucht.'
    default_diarize = False
    default_endpointing = False
    default_volume = 100

st.text_input("Deepgram Model", value=default_model, key="config_model")

st.text_area("System Prompt", value=default_prompt, key="config_sys_prompt")

st.toggle("Diarize", value=default_diarize, key="config_diarize_toggle")

st.text_input("Endpointing (False for off)", value=default_endpointing, key="config_endpointing")

st.slider("Mikrofonlautstärke (%)", min_value=0, max_value=1000, step=50, value=default_volume, key="config_volume")

# Speichern als JSON
st.text_input("Config Name", key="config_name_input")

if st.button("Speichern"):
    save_json()


