import { uploadAudioToFirebase } from 'backend/speetToText.jsw'; // Asegúrate de que la ruta es correcta

class AudioRecorder extends HTMLElement {
    constructor() {
        super();
        
        // Crear shadow DOM
        const shadow = this.attachShadow({ mode: 'open' });

        // Crear un elemento de estilo
        const style = document.createElement('style');
        style.textContent = `
            #recordButton, #stopButton, #playButton {
                margin: 10px;
                padding: 10px;
                background-color: #4CAF50;
                color: white;
                border: none;
                cursor: pointer;
            }
            #stopButton, #playButton {
                display: none;
            }
        `;

        // Crear el HTML del template
        const template = document.createElement('template');
        template.innerHTML = `
            <button id="recordButton">Start Recording</button>
            <button id="stopButton">Stop Recording</button>
            <button id="playButton">Play</button>
            <audio id="audioPlayback"></audio>
            <div id="results"></div>
        `;

        // Adjuntar el contenido del template al shadow DOM
        shadow.appendChild(style);
        shadow.appendChild(template.content.cloneNode(true));

        // Asignar elementos a propiedades de la clase
        this.recordButton = shadow.getElementById('recordButton');
        this.stopButton = shadow.getElementById('stopButton');
        this.playButton = shadow.getElementById('playButton');
        this.audioPlayback = shadow.getElementById('audioPlayback');
        this.resultsDiv = shadow.getElementById('results');
        this.mediaRecorder = null;
        this.audioChunks = [];

        // Asignar eventos
        this.recordButton.addEventListener('click', () => this.startRecording());
        this.stopButton.addEventListener('click', () => this.stopRecording());
        this.playButton.addEventListener('click', () => this.playRecording());
    }

    async startRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];
        
        // Capturar el audio a medida que se graba
        this.mediaRecorder.ondataavailable = (event) => {
            this.audioChunks.push(event.data);
        };

        // Cuando la grabación termine
        this.mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            this.audioPlayback.src = URL.createObjectURL(audioBlob);

            // Enviar el archivo de audio al backend para subirlo a Firebase
            try {
                const audioUrl = await uploadAudioToFirebase(audioBlob); // Llama al backend para subir el archivo
                console.log("URL del archivo subido:", audioUrl);

                const expectedPhrase = "La frase esperada aquí"; // Personaliza según tu caso

                // Enviar la URL al backend para la evaluación
                const evaluation = await generateTextFromAudio(audioUrl, expectedPhrase);
                console.log('Evaluación:', evaluation);

                // Mostrar los resultados en la UI
                this.resultsDiv.innerHTML = `
                    <p>Transcripción: ${evaluation.transcription}</p>
                    <p>Evaluación: ${evaluation.evaluation}</p>
                `;
            } catch (error) {
                console.error('Error enviando el audio al backend de Wix:', error);
                this.resultsDiv.innerHTML = `<p>Error procesando el audio</p>`;
            }
        };

        this.mediaRecorder.start();

        this.recordButton.style.display = 'none';
        this.stopButton.style.display = 'inline';
    }

    stopRecording() {
        this.mediaRecorder.stop();
        this.recordButton.style.display = 'inline';
        this.stopButton.style.display = 'none';
        this.playButton.style.display = 'inline';
    }

    playRecording() {
        this.audioPlayback.play();
    }
}

// Definir el custom element
customElements.define('audio-recorder', AudioRecorder);
