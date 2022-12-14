let path = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_med_lokl_q2';  

// initialize musicVAE model 
const mvae = new mm.MusicVAE(path); 
mvae.initialize();  


// initialize musicRNN model 
const mRNN = new mm.MusicRNN("https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn");
mRNN.initialize();  

// initizalize player
const player = new mm.Player();

// variables to keep track of things 
let temperature = 0.5;  
let control_temp; 
let bpm = 120;
let midi_bytes_array;
let similarSequences;  
let currentSample; 
let midi; 
let sequence;
let imported_sequences;

const inputElement = document.getElementById('fileInput');
inputElement.addEventListener('change', function() {

  // When the user selects a file, it will be stored in the `files` property of the `<input>` element
  const selectedFile = inputElement.files[0];

  // Next, create a FileReader object to read the file
  const fileReader = new FileReader();

  // Set up a callback to be called when the file has been read
  fileReader.onload = () => {
    // The file has been read, and the result is stored in the `result` property of the FileReader object
    const midiFileAsUnit8Array = new Uint8Array(fileReader.result);
    console.log("file was succesfully uploaded and converted to Unit8Array"); 
    imported_sequences = mm.midiToSequenceProto(midiFileAsUnit8Array);
    midi_bytes_array = midiFileAsUnit8Array; 
    imported_sequences = mm.sequences.quantizeNoteSequence(imported_sequences,4); 
    currentSample = imported_sequences;
     visualize(); 
     enable_buttons();
  };
  // Start reading the file
  fileReader.readAsArrayBuffer(selectedFile);
});

async function generate(){
   
  mm.Player.tone.context.resume(); 
  temperature = 1; 

  // Generate a new melody using the musicVAE model.
 sequence = await mvae.sample(1, temperature);
 currentSample = sequence[0]; 
 //console.log(currentSample); 
 currentSample.notes.forEach(n => n.velocity = bpm); 
 midi_bytes_array = mm.sequenceProtoToMidi(currentSample);
  enable_buttons();
  visualize();   
}

function stop(){
  if(player.isPlaying()){
    player.stop(); 
  }
}

function play(){
    player.start(currentSample); 
  
}

function save(){
  currentSample.notes.forEach(n => n.velocity = bpm); 
  midi_bytes_array = mm.sequenceProtoToMidi(currentSample);
  midi = saveAs(new File([midi_bytes_array], 'sample.mid'));
}

async function similar(){
  // generate similar sequence 
  temp =  Math.round(Math.random() * 10) / 10; 
  temp_soft = 1; 
  //console.log(temp); 
  similarSequences = await mvae.similar(currentSample, 5, temp, temp_soft);
  currentSample = similarSequences[0];   
  visualize(); 
}

function visualize(){
  vizSample = new mm.PianoRollSVGVisualizer(
    currentSample, document.getElementById('vizSample'), 
    {noteRGB:'35,70,90', activeNoteRGB:'157, 229, 184', noteHeight:5}); 
}

function enable_buttons(){
 //enable other buttons 
 document.getElementById("stop").disabled = false;
 document.getElementById("similar").disabled = false;
 document.getElementById("save").disabled = false;
 document.getElementById("play").disabled = false;
}

function showMainScreen() {
  // Get the "startPage" and "mainScreen" elements
  var startPage = document.getElementById("startPage");
  var mainScreen = document.getElementById("mainScreen");

  // Hide the "startPage" element
  startPage.hidden = true;

  // Show the "mainScreen" element
  mainScreen.hidden = false;
}

async function continue_sequence(){
  let continued_sequence = await mRNN.continueSequence(currentSample, 50, 1); 
  // console.log(continued_sequence); 
  continued_sequence.notes.forEach(n => n.velocity = bpm); 
  const mels = [currentSample,continued_sequence];
  let concatenated = mm.sequences.concatenate(mels); 
  currentSample = concatenated; 
  visualize(); 
  //console.log('generated continued sequence');
}