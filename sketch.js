// constants 
let path = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_vae/mel_4bar_med_lokl_q2';  
const soundFontURL = 'https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus';

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
let vizSample; 

// function to handle description button 
function toggleDescription() {
  const modalBackground = document.getElementById("modal-background");
  if (modalBackground.style.display === "none" || !modalBackground.style.display) {
      modalBackground.style.display = "flex";
  } else {
      modalBackground.style.display = "none";
  }
}

// initialize musicVAE model 
const mvae = new mm.MusicVAE(path); 
mvae.initialize();  

// initialize musicRNN model 
const mRNN = new mm.MusicRNN("https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/melody_rnn");
mRNN.initialize();  

// initizalize player
//const player = new mm.Player();
const player = new mm.SoundFontPlayer(soundFontURL);

// show notification once 
if (!currentSample ){
  showNotification("There is no note sequence provided. Please use generate button or upload your midi file.", 10000); 
}

// functions to handle loading message 
function showLoading() {
  const indicator = document.getElementById('loadingIndicator');
  indicator.classList.remove('hidden');
}
function hideLoading() {
  const indicator = document.getElementById('loadingIndicator');
  indicator.classList.add('hidden');
}

// handling upload 
const inputElement = document.getElementById('fileInput');
inputElement.addEventListener('change', function() {

  // the user selects a file, it will be stored in the `files` property of the `<input>` element
  const selectedFile = inputElement.files[0];

  // a FileReader object to read the file
  const fileReader = new FileReader();

  // callback to be called when the file has been read
  fileReader.onload = () => {
    // The file has been read, and the result is stored in the `result` property of the FileReader object
    const midiFileAsUnit8Array = new Uint8Array(fileReader.result);
    //console.log("file was succesfully uploaded and converted to Unit8Array"); 
    imported_sequences = mm.midiToSequenceProto(midiFileAsUnit8Array);
    midi_bytes_array = midiFileAsUnit8Array; 
    imported_sequences = mm.sequences.quantizeNoteSequence(imported_sequences,4); 
    currentSample = imported_sequences;
     visualize(); 
     enable_buttons();
  };
  // start reading the file
  fileReader.readAsArrayBuffer(selectedFile);
  showNotification("File successfully uploaded!", time);
});

 // function to handle notifications with specified time 
function showNotification(message, time) {
  const notification = document.getElementById("notification");
  const notificationText = document.getElementById("notification-text");

  notificationText.textContent = message;
  notification.classList.remove("notification-hidden");
  notification.classList.add("notification-shown");

  // Hide notification after [time] seconds
  setTimeout(() => {
      notification.classList.remove("notification-shown");
      notification.classList.add("notification-hidden");
  }, time);
}

// function to handle generation of a melody from musicVAE model 
async function generate(){
  if(player.isPlaying){
    player.stop();
  }
  showLoading();
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
  hideLoading(); 
}

// function to handle stop 
function stop(){
  if(player.isPlaying()){
    player.stop(); 
  }
}

// function to handle play 
function play() {
  player.callbackObject = {
      run: (note) => {
          vizSample.redraw(note, true);
          highlightNote(Tonal.Note.fromMidi(note.pitch));
      },
      stop: () => {
          clearHighlightedNotes();
      }
  };
  player.start(currentSample); 
}

// function to handle saving midi file 
function save(){
  currentSample.notes.forEach(n => n.velocity = bpm); 
  midi_bytes_array = mm.sequenceProtoToMidi(currentSample);
  midi = saveAs(new File([midi_bytes_array], 'sample.mid'));
}

// function to handle creation of a similar note sequence to the current note sequence 
async function similar(){
  // generate similar sequence 
  if(player.isPlaying){
    player.stop();
  }
  temp =  Math.round(Math.random() * 10) / 10; 
  temp_soft = 1; 
  //console.log(temp); 
  similarSequences = await mvae.similar(currentSample, 5, temp, temp_soft);
  currentSample = similarSequences[0];   
  visualize(); 
}

// function to continue note sequence 
async function continue_sequence(){
  if(player.isPlaying){
    player.stop();
  }
  let continued_sequence = await mRNN.continueSequence(currentSample, 50, 1); 
  continued_sequence.notes.forEach(n => n.velocity = bpm); 
  const mels = [currentSample,continued_sequence];
  let concatenated = mm.sequences.concatenate(mels); 
  currentSample = concatenated; 
  visualize(); 
}

// function to handle visualization of the midi generated 
function visualize(){

  const sequenceLength = currentSample.notes.length;
  let noteHeight = 6; 
  let noteSpacing = 1;
  if (sequenceLength > 100) {
    noteHeight = 4;
    noteSpacing = 0.5;
  } else if (sequenceLength > 200) {
    noteHeight = 3;
    noteSpacing = 0.25;
  }
  
  const vizConfig = {
    noteHeight: noteHeight,
    noteSpacing: noteSpacing,
    noteRGB: '68, 68, 68',
    activeNoteRGB: '144, 130, 234',
  };
  
  vizSample = new mm.PianoRollSVGVisualizer(currentSample, document.getElementById('vizSample'), vizConfig );
  detectedNotes = detectNotesFromSequence(currentSample); 
  //console.log(detectedNotes); 
  displayDetectedNotes(detectedNotes);
}

// function to detect notes from current note sequence 
function detectNotesFromSequence(sequence) {
  const noteNames = sequence.notes.map(note => {
      return Tonal.Note.fromMidi(note.pitch);
  });

  const uniqueNoteNames = Array.from(new Set(noteNames));  // Remove duplicates for efficiency
  //console.log(uniqueNoteNames); 

  return uniqueNoteNames;
}

// function to handle display current active notes 
function displayDetectedNotes(notesArray) {
  const notesDisplay = document.getElementById("detectedNotesDisplay");
  notesDisplay.innerHTML = "Detected Notes: ";  

  notesArray.forEach((note, index) => {
      const span = document.createElement("span");
      span.id = `note-${note}`;
      span.textContent = note + (index !== notesArray.length - 1 ? ", " : "");
      notesDisplay.appendChild(span);
  });
  notesDisplay.classList.remove("notes-display-hidden");
  notesDisplay.classList.add("notes-display-shown");
}

// function to handle highlighting notes 
function highlightNote(noteName) {
  clearHighlightedNotes();  // Clear any previously highlighted notes
  const noteElement = document.getElementById(`note-${noteName}`);
  if (noteElement) {
      noteElement.classList.add("highlight-note");
  }
}

// function to clear highlights 
function clearHighlightedNotes() {
  const highlightedNotes = document.querySelectorAll('.highlight-note');
  highlightedNotes.forEach(note => note.classList.remove('highlight-note'));
}

// function to handle disabled buttons 
function enable_buttons(){
 // enable other buttons 
 document.getElementById("stop").disabled = false;
 document.getElementById("similar").disabled = false;
 document.getElementById("continue").disabled = false;
 document.getElementById("save").disabled = false;
 document.getElementById("play").disabled = false;
}