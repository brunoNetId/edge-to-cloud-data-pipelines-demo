// Set constraints for the video stream
var constraints = { video: { facingMode: "user" }, audio: false };
var track = null;

// Define constants
const cameraView = document.querySelector("#camera--view"),
    cameraOutput = document.querySelector("#camera--output"),
    cameraSensor = document.querySelector("#camera--sensor"),
    cameraTrigger = document.querySelector("#camera--trigger"),

    btnHttp = document.querySelector("#protocol--http"),
    btnMqtt = document.querySelector("#protocol--mqtt"),

    filePicker = document.querySelector("#fileInput");

// Access the device camera and stream to cameraView
function cameraStart() {
    navigator.mediaDevices
        .getUserMedia(constraints)
        .then(function(stream) {
            track = stream.getTracks()[0];
            cameraView.srcObject = stream;
        })
        .catch(function(error) {
            console.error("Oops. Something is broken.", error);
        });
}

// Take a picture when cameraTrigger is tapped
cameraTrigger.onclick = function() {
    cameraSensor.width = cameraView.videoWidth;
    cameraSensor.height = cameraView.videoHeight;

    // fwidth = 400
    // factor = fwidth/cameraSensor.width
    // fheight = cameraSensor.height * factor

    cameraSensor.getContext("2d").drawImage(cameraView, 0, 0);
    // cameraSensor.getContext("2d").drawImage(cameraView, 0, 0, fwidth, fheight);
    cameraOutput.src = cameraSensor.toDataURL("image/jpeg");
    cameraOutput.classList.add("taken");

    btnHttp.hidden = false
    btnMqtt.hidden = false

    // sendHttp(cameraOutput.src)
    // track.stop();
};

function resizeImage(base64Str) {

    var img = new Image();
    img.src = base64Str;
    var canvas = document.createElement('canvas');
    var MAX_WIDTH = 400;
    var MAX_HEIGHT = 350;
    var width = img.width;
    var height = img.height;

    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg");
  }


// Send via HTTP when the button is tapped
btnHttp.onclick = function() {
    sendHttp(cameraOutput.src)
};

// Send via MQTT when the button is tapped
btnMqtt.onclick = function() {
    sendMqtt(cameraOutput.src)
};

// called when the MQTT client connects
function onConnect() {
    // Once a connection has been made, make a subscription and send a message.
    console.log("MQTT: connected to broker");
}

function onFailure(responseObject){

    var status = document.querySelector("#mqtt-status");
    status.style.color = 'red';

    // Once a connection has been made, make a subscription and send a message.
    console.log("MQTT: connection lost");
}

fileInput.onchange= function(event) {

	// var image = document.getElementById('outputHttp');
	// image.src = URL.createObjectURL(event.target.files[0]);
	
    file = event.target.files[0];

    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function () {


        cameraOutput.src = reader.result;
 
        cameraSensor.getContext("2d").drawImage(cameraOutput, 0, 0);


        cameraOutput.classList.add("taken");
    
        btnHttp.hidden = false
        btnMqtt.hidden = false

    };
    reader.onerror = function (error) {
      console.log('Error: ', error);
    };

	// sendHttp(event.target.files[0]);

    // viaMqtt(event)
}


function sendHttp(srcImage) {
  
    const Http = new XMLHttpRequest();
    const url=window.origin+"/detection"

    Http.open("POST", url);
    Http.setRequestHeader("Content-Type", "application/json;charset=UTF-8");

    reduced = resizeImage(srcImage)
    Http.send(JSON.stringify({ "image": reduced.replace("data:image/jpeg;base64,", "")}));

    Http.onreadystatechange = function() {
      if (this.readyState == 4 && this.status == 200) {
          console.log(Http.responseText)

        var tag = document.getElementById("price--tag")

        tag.innerHTML = Http.responseText

        tag.classList.add("fade-out")

        var cleanfader=setInterval(removeFader, 5000);
        function removeFader()
        {
            tag.classList.remove("fade-out")
            // tag.style.opacity = 1
            // alert("removing fader!");
            clearInterval(cleanfader);
        }

    }
    }	
}

function sendMqtt(srcImage) {
    reduced = resizeImage(srcImage)
    // jsonMsg = JSON.stringify({ "image": srcImage.replace("data:image/jpeg;base64,", "")})
    jsonMsg = JSON.stringify({ "image": reduced.replace("data:image/jpeg;base64,", "")})
    message = new Paho.MQTT.Message(jsonMsg);
    message.destinationName = "detection";
    client.send(message);
    console.log("MQTT message sent.")
}


// Start the video stream when the window loads
window.addEventListener("load", cameraStart, false);


var brokerHost = window.location.hostname.replace("camel-edge", "broker-amq-mqtt")
var brokerPort = window.location.port 
const brokerUrl=window.location.href+"/test"

var brokerOptions = null

//For local testing: when loading the page directly on the browser
if (brokerHost == ""){
    brokerHost = "localhost"
    brokerPort = "8080"
}

//For local testing
if (brokerPort == "8080"){
	brokerPort = "1883"
	brokerOptions = {onSuccess:onConnect}
}
else{
	brokerPort = "443"
	brokerOptions = {useSSL:true,onSuccess:onConnect, onFailure:onFailure}
}


let uid = Date.now().toString(36) + Math.random().toString(36).substr(2)

// Create a client instance
client = new Paho.MQTT.Client(brokerHost, Number(brokerPort), "CameraClient-"+uid);

// set callback handlers
// client.onConnectionLost = onConnectionLost;
// client.onMessageArrived = onMessageArrived;

// connect the client
client.connect(brokerOptions);

const interval = setInterval(function() {

    // console.log("checking connectivity")
    var status = document.querySelector("#mqtt-status");

    if(client.isConnected()){
        status.style.color = 'lightgreen';
        status.parentElement.disabled=false
    }
    else{
        status.style.color = 'red';
        status.parentElement.disabled=true
        //somehow this field is automatically created on first connect
        //we need to remove it, otherwise it won't reconnect.
        delete brokerOptions.mqttVersionExplicit
        client.connect(brokerOptions);
    }
    // method to be executed;
}, 1000);
