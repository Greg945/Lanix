import streamlit as st
from google import genai
from google.genai.types import Tool, GenerateContentConfig, GoogleSearch, Image
import io
import base64

client = genai.Client(api_key="AIzaSyA3iQXk6-M5XQhzLIMO3SfEAKDPRunTHP8")

google_search_tool = Tool(google_search=GoogleSearch())

# Systemanweisung für Gemini
SYS_INSTRUCT = ('Du bist ein mithörender Assistent in einem Klassenzimmer. Wenn du eine Frage hörst, beantworte sie bitte normal. '
                'Wenn es keine Frage ist, antworte nur mit "Ignoriert". Außerdem bekommst du immer den Konversationsverlauf, '
                'den du nur benutzt, falls du Informationen daraus zur Beantwortung der Frage brauchst.')



def gemini_request(text, picture, file):
    #context = st.session_state.context
    #search_enabled=st.session_state.get("search", False)
    try:
        contents = [text]
        if picture:
            image_bytes = picture.getvalue()
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            contents.append(Image(mime_type="image/jpeg", data=base64_image))
        elif file:
            for uploaded_file in file:
                bytes_data = uploaded_file.read()
                contents.append({
                    "mime_type": uploaded_file.type,
                    "data": bytes_data
                })
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            config=GenerateContentConfig(
                system_instruction=SYS_INSTRUCT,
                #tools=[google_search_tool] if search_enabled else [],
                response_modalities=["TEXT"]
            ),
            contents=contents,
        )
        response_text = response.text.strip()
    except Exception as e:
        response_text = f"Fehler bei der API-Anfrage: {e}"
        st.error(response_text)

    st.session_state.context.append({"user": text, "assistant": response_text})

    #save_chat_history(st.session_state.context)
    print('Apicall for:', text)
    print(response_text)
    return response_text


st.header("photo")

picture = st.camera_input("Take a picture")

uploaded_file = st.file_uploader(
    "Upload File", accept_multiple_files=True
)
prompt = "Beantworte Aufgabe: "

prompt += st.radio(
    "Beantworte Aufgabe", 
    ["Alle auf dem Foto",
    str(st.number_input("Specific Nummer", 1, step=1, key="single")),
    str(st.number_input("Min Nummer", 1, step=1, key="min")) + " bis " + str(st.number_input("Max Nummer", 1, step=1, key="max"))
    ]
)

prompt += " " + st.radio("Wörter", ["", "in " + str(st.number_input("Anzahl Wörtern", 0, value=100, step=25, key="words")) + " Wörtern "]) 

prompt += st.radio("Textsorte", ["", "in " + "Stichpunkten ", "als " + "Fließtext ", "in " + st.text_input("Custom Type")]) 

prompt += " in leichter Sprache " if st.checkbox("in leichter Sprache") else ""
prompt += " in " + st.selectbox("Sprache", ("Deutsch", "Englisch", "Französisch"))



custom_prompt = st.text_input("Custom prompt")
if custom_prompt:
    prompt = custom_prompt
st.write("Prompt:", prompt)
  
if st.button("Submit"):
    if picture:
        gemini_request(prompt, picture, None)
    elif uploaded_file:
        gemini_request(prompt, None, uploaded_file)

#if uploaded_file is not None:
#    for file in uploaded_file:
#        bytes_data = file.read()
#        st.write("filename:", file.name)
#        st.write("file type:", file.type)
#        st.write("file size:", len(bytes_data), "bytes")
#        st.download_button(
#            label="Download",
#            data=bytes_data,
#            file_name=file.name,
#            mime=file.type,
#        )
