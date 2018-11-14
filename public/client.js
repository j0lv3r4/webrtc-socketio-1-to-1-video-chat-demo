// client-side js
// run by the browser each time your view template is loaded

(function() {
  
  /* UI */

  const formLogin = document.getElementById('form-login');
  const fieldUsername = document.getElementById('username');
  const usersListElement = document.getElementById('users-list');
  const localVideo = document.getElementById('local-video');
  const remoteVideo = document.getElementById('remote-video');

  /* Globals */
  
  let socket;
  let caller;
  let receiver;
  let peerConnection;
  const mediaConstraints = { audio: false, video: { width: 320, height: 320 } }
  const servers = {
    'iceServers': [
      {'urls': 'stun:stun.stunprotocol.org:3478'},
      {'urls': 'stun:stun.l.google.com:19302'},
    ]
  };
  
  /* Functions */
  
  function sendToServer(msg) {
    socket.emit('message', JSON.stringify(msg));
  }
  
  function updateListElement(usersArray, listElement) {    
    const updatedList = usersArray.map(user => `
      <li class="user-item">
        ${user.name} <button class="call" data-target="${user.name}">Call</button>
      </li>
    `).join('');

    // Re-render user list
    listElement.innerHTML = updatedList;

    // Add event listeners to call button next to the user
    const callButtons = document.getElementsByClassName('call');
    Object.keys(callButtons).forEach(key => callButtons[key].addEventListener('click', inviteToVideoCall));
  }
  
  async function getLocalMedia(peerConnection) {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      mediaStream.getTracks().forEach(track => peerConnection.addTrack(track, mediaStream));
      return mediaStream;
    } catch (error) {
      console.error(error);
    }
  }
  
  function connect(event) {
    event.preventDefault();
    
    // Hide form overlay
    event.target.parentNode.classList.add('hidden');
        
    caller = fieldUsername.value;
    
    console.info(`Connecting ${caller}...`);
    
    // Connect to signaling server
    socket = io();
      
    // We tell the server who we are
    sendToServer({
      name: caller,
      date: Date.now(),
      type: 'username',
    });

    // When we receive the updated list of users we render them in the UI
    socket.on('users', (msg) => {
      const msgJSON = JSON.parse(msg);
      updateListElement(msgJSON.users, usersListElement)
    });

    // Listen to messages coming from signaling server
    socket.on('message', (msg) => {
      switch(msg.type) {     
        case 'offer':
          answerOffer(msg);
          break;

        case 'answer':
          receiveAnswer(msg);
          break;

        case 'ice-candidate':
          addICECandidate(msg);
          break;           
      }
    });
  }
    
  async function inviteToVideoCall(event) {
    // Check if we have an open connection already
    if (peerConnection) {
      console.warning('You already have a call open.');
    } else {
      receiver = event.target.getAttribute('data-target');
      
      if (receiver === caller) {
        alert("You can't call yourself.");
        return;
      }  
      
      peerConnection = createPeerConnection();

      // Requesting webcam access...
      localVideo.srcObject = await getLocalMedia(peerConnection);
    }
  }
  
  function createPeerConnection() {
    console.log(`${caller} inviting ${receiver} to video call...`);
    
    // Starts the peer connection
    const peerConnection = new RTCPeerConnection(servers);
        
    // Sends out our ICE candidate through our signaling server
    peerConnection.onicecandidate = ({ candidate }) => {
      if (candidate) {        
        sendToServer({
          type: 'ice-candidate',
          target: receiver, // on the receiver side this is undefined.
          candidate: candidate,
        });
      }
    };

    // Creates an offer and sends it out through the signaling server
    peerConnection.onnegotiationneeded = createOffer;
 
    // When we get a track we add it to our remote video element
    peerConnection.ontrack = event => remoteVideo.srcObject = event.streams[0];
    
    return peerConnection;
  }

  async function createOffer() {
    console.log(`${caller} is creating an offer for ${receiver}`);
    
    try {
      // 1. Create an offer
      const offer = await peerConnection.createOffer();
      // 2. set the offer as local description
      await peerConnection.setLocalDescription(offer);
      // Send offer to remote peer
      sendToServer({
        name: caller,
        target: receiver,
        type: 'offer',
        sdp: peerConnection.localDescription,
      });
    } catch (error) {
      console.error(`Error when creating the offer: ${error}`);
    }
  }
  
  async function answerOffer(msg) {    
    // We save the reference of the people sending the offer
    const receiver = msg.name;
    
    console.log(`${caller} is creating an answer for ${receiver}`);
    
    // Start the PeerConnection
    peerConnection = createPeerConnection();
    
    // 4. The recipient receives the offer and record it as the remote description
    try {
      await peerConnection.setRemoteDescription(msg.sdp);
      // 5. The recipient includes its stream to the connection
      localVideo.srcObject = await getLocalMedia(peerConnection);
      // 6. The recipient creates an answer
      const answer = await peerConnection.createAnswer();
      // 7. The recipient set the answer as its local description.
      await peerConnection.setLocalDescription(answer);
      // 8. The recipient uses the signaling server to send the answer to the caller.
      sendToServer({
        name: caller,
        target: receiver,
        type: 'answer',
        sdp: peerConnection.localDescription,
      });
    } catch (error) {
      console.error(`Error when creating the answer: ${error}`);
    }
  }
  
  // This function i scalled when the caller receives an answer from the recipient about
  // the video call offer we sent
  async function receiveAnswer(msg) {
    console.log('handling answer ', msg);

    // 9. The caller receives the answer.
    // 10. The caller set the answer as the remote description. It know knows the
    // configuration of both peers. Media begins to flow as configured
    await peerConnection.setRemoteDescription(msg.sdp);
  }
  
  async function addICECandidate(msg) {
    const candidate = new RTCIceCandidate(msg.candidate);
        
    try {
      await peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error(error);
    }
  }
  
  /* DOM event listeners */
  
  formLogin.addEventListener('submit', connect);
})();