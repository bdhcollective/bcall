const sendBtn = document.getElementById('sendBtn');
const callBtn = document.getElementById('callBtn');
const numberInput = document.getElementById('number');
const messageInput = document.getElementById('message');
const messagesListContainer = document.getElementById('message-list');
const groupedMessages = {};
const phoneBar = document.querySelector('.phone-bar');
const btnBDH = document.getElementById('BdhBtn');
const btnBernardson = document.getElementById('BernardsonBtn');
const chatList = document.getElementById('chat-list');
const select = document.getElementById('twilio-number');
const numberCallThru =  document.getElementById('numberCallThru');
async function getContactName(phone) {
  try {
    const response = await fetch(`/api/api/contacts/${encodeURIComponent(phone)}`);
    if (response.ok) {
      const contact = await response.json();
      return contact.name || null;
    }
  } catch (err) {
    console.error("Error retrieving contact :", err);
  }
  return null;
}


function saveContact(phoneNumber, name) {
  fetch('/api/api/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ phone: phoneNumber, name })
  })
    .then(res => res.json())
    .then(data => {
      console.log('Registered contact:', data);
      alert('Name saved successfully');
    })
    .catch(err => console.error('Error:', err));
}
function chargerNumerosTwilio() {
  fetch('/api/getTwilioNumbers')
    .then(res => res.json())
    .then(data => {
      if (data.success && Array.isArray(data.numbers)) {
        data.numbers.forEach(num => {
          const option = document.createElement('option');
          option.value = num;
          option.textContent = num;
          select.appendChild(option);
        });
      } else {
        alert("Twilio network error numbers");
      }
    })
    .catch(() => alert("Twilio network error numbers"));
}

document.addEventListener('DOMContentLoaded', () => {
  chargerNumerosTwilio();
});

async function renderMessages() {
  messagesListContainer.innerHTML = '';
  const conversationNumbers = Object.keys(groupedMessages);
  if (conversationNumbers.length === 0) {
    messagesListContainer.innerHTML = '<p>No conversation selected.</p>';
    return;
  }

  const number = conversationNumbers[0];
  const messages = groupedMessages[number];

  const section = document.createElement('div');
  section.className = 'message-group';
  const btnRetour = document.createElement('button');
  btnRetour.className = 'btnRetour';
  btnRetour.textContent = '←';
  const contactName = await getContactName(number);
  const header = document.createElement('h4');
  header.textContent = `Conversation with ${contactName || number}`;
  const btn = document.createElement('button');
  btn.className = 'btn-edit';
  btn.textContent = 'Edit';
  btn.addEventListener('click', () => {
    const newName = prompt('Enter a name for this number :', contactName || '');
    if (newName && newName.trim()) {
      saveContact(number, newName.trim());
      renderMessages();
    }
  });
  btnRetour.addEventListener('click', () => {
    document.getElementById('message-list').innerHTML = '';
  });
  section.appendChild(header);
  header.prepend(btnRetour);
  header.appendChild(btn);

  messages.forEach(msg => {
    const div = document.createElement('div');
    div.className = 'message ' + msg.type;

    if (msg.type === 'call') {
      if (msg.status) {
        div.classList.add('status-' + msg.status);
      }
    }

  if (msg.media && msg.media.length > 0) {
    const mediaItem = msg.media[0];
    const img = document.createElement('img');
    img.src = mediaItem.url;
    img.alt = 'Attached media';
    img.style.maxWidth = '100%';
    div.appendChild(img);

    if (msg.content && msg.content !== '(empty message)') {
      const p = document.createElement('p');
      p.textContent = msg.content;
      div.appendChild(p);
    }
  } else {
    div.textContent = msg.content;
  }
    section.appendChild(div);
  });

  messagesListContainer.appendChild(section);
}

function loadHistory(number, twilioNumber) {
  fetch(`/api/getHistory?number=${encodeURIComponent(number)}&twilioNumber=${encodeURIComponent(twilioNumber)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    }
  })
    .then(res => res.json())
    .then(data => {
      if (!data.success || !Array.isArray(data.messages) || !Array.isArray(data.calls)) {
        throw new Error('Unexpected format');
      }
      for (const key in groupedMessages) {
        delete groupedMessages[key];
      }

      const messagesForNumber = [];

      data.messages.forEach(msg => {
let messageContent = msg.body || '(empty message)';
  let messageMedia = false;

  if (msg.media && msg.media.length > 0) {
    messageMedia = msg.media;
    if (!msg.body) {
      messageContent = `Attached file (${msg.media.length})`;
    }
  }
        messagesForNumber.push({
          type: msg.direction === 'outbound-api' ? 'sent' : 'received',
          content: msg.body || '(empty message)',
          date: msg.dateSent,
          from: msg.from,
          to: msg.to,
          media:  messageMedia //msg.media && msg.media.length > 0 ? msg.media : false
        });
      });

      data.calls.forEach(call => {
        messagesForNumber.push({
          type: 'call',
          subtype: call.direction,
          status: call.status.toLowerCase(),
          sid: call.sid,
          content: `Appel ${call.direction} - ${call.status} (${call.duration || 0}s)`,
          date: call.startTime,
          from: call.from,
          to: call.to,
          media: false
        });
      });

      messagesForNumber.sort((a, b) => new Date(a.date) - new Date(b.date));

      // We add the new conversation to the object
      groupedMessages[number] = messagesForNumber;

      renderMessages();
    })
    .catch(err => {
      console.error('Error loading history:', err);
      alert("Unable to load history");
    });
}
numberInput.addEventListener('change', () => {
  const number = numberInput.value.trim();
  const fromNumberText = document.querySelector('.phone-number-item.active');
  const twilioNumber = fromNumberText.textContent.trim();
  if (number) {
    loadHistory(number, twilioNumber);
  }
});

function sendMessage() {
  const number = numberInput.value.trim();
  const text = messageInput.value.trim();

  if (!number || !text) {
    alert('Please fill in all fields.');
    return;
  }

  if (!groupedMessages[number]) {
    groupedMessages[number] = [];
  }

  groupedMessages[number].push({ type: 'sent', content: text });
  renderMessages();
  const from = document.getElementById('twilio-number').value;

  fetch('/api/sendSms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: number, message: text, from })
  })
    .then(res => res.json())
    .then(data => {
      console.log('Message sent', data);
      setTimeout(() => loadHistory(number), 2000);
    })
    .catch(err => {
      console.error('Error:', err);
      alert('Error sending');
    });

  messageInput.value = '';
}

sendBtn.addEventListener('click', sendMessage);

async function chargerListeChats() {
  const url = '/api/getRecentsContacts';

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const data = await response.json();
    chatList.innerHTML = '';

    if (typeof data !== 'object' || data === null) return;

    for (const [fromNumber, responseData] of Object.entries(data)) {
      if (!responseData || !responseData.success || !Array.isArray(responseData.contacts)) {
        console.error(`Unexpected data for ${fromNumber} :`, responseData);
        continue;
      }
      const nameNumber = await getContactName(fromNumber);
      const section = document.createElement('div');
      section.classList.add('twilio-section');

      const header = document.createElement('h3');
      header.textContent = `Depuis ${nameNumber || fromNumber}`;

      section.appendChild(header);

      for (const contact of responseData.contacts) {
        const contactName = await getContactName(contact.number);
        const displayName = contactName || contact.number;

        const item = document.createElement('div');
        item.classList.add('chat-item');

        const lastMessage = contact.lastMessage || '(No message)';
        const date = contact.dateSent
          ? new Date(contact.dateSent).toLocaleString()
          : 'Date unknown';

        item.innerHTML = `
          <strong>${displayName}</strong><br>
          <small>${date}</small><br>
          <span>${lastMessage.slice(0, 30)}...</span>
        `;

        item.addEventListener('click', () => {
          loadHistory(contact.number, fromNumber);
          document.getElementById('twilio-number').value = fromNumber;
          document.getElementById('number').value = contact.number;
        });

        section.appendChild(item);
      }

      chatList.appendChild(section);
    }
  } catch (err) {
    console.error('Error loading recent contacts :', err);
  }
}

// The main function that manages connection and calls
async function connectToTwilio() {
    try {
        // 1. Get the Access Token from backend
        const tokenResponse = await fetch('/api/generate-token');
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.token;

        // 2. Initialize Twilio.Device with Access Token
        const device = new Twilio.Device(accessToken, {
            // You can add options here if needed
        });

        // 3. Manage device events
        device.on('ready', (device) => {
            console.log('Twilio.Device is ready to make calls!');
        });

        device.on('error', (error) => {
            console.error('Error Twilio.Device :', error.message);
        });

        return device;
    } catch (err) {
        console.error('Twilio connection error :', err);
    }
}
// Retrieve the Twilio device once it is ready
let twilioDevice = null;
connectToTwilio().then(device => {
    twilioDevice = device;
});

// This function will be called when the user wants to make a call
function makeCall(phoneNumber) {
    if (!twilioDevice) {
        console.error("Twilio.Device is not ready yet.");
        return;
    }
    const numberFrom = select.value.trim();
    const params = {
        To: phoneNumber,
        From: numberFrom
    };

    // Make the call
    const activeCall = twilioDevice.connect(params);

    // Handle call events
    activeCall.on('accept', (call) => {
        console.log('Call accepted !');
        // Update UI
    });

    activeCall.on('disconnect', (call) => {
        console.log('Call ended.');
        // Update UI
    });
}

function hangupCallThru() {
  if (!currentCallSidThru) {
    alert("No call in progress to hang up.");
    return;
  }

  callThruBtn.disabled = true;
  callThruBtn.innerText = 'Hanging up...';

  fetch('/api/hangupCall', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sid: currentCallSidThru }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        alert('Call hung up');

        callThruBtn.disabled = false;
        callThruBtn.textContent = 'Call Thru';

        callThruBtn.removeEventListener('click', hangupCallThru);
        callThruBtn.addEventListener('click', makeCallThru);

        loadHistory(numberInput.value.trim());
      } else {
        alert('Error: ' + data.error);
      }
    })
    .catch(err => {
      console.error('Error:', err);
      alert('Network error');

      callThruBtn.disabled = false;
      callThruBtn.textContent = 'To hang up'; // If it fails, we keep it.
    });
}

// Global variable to store the ID of the current call
let currentCallSidThru = null;
function makeCallThru() {
  const numberFrom = select.value.trim();
  const number = numberInput.value.trim();
  if (!number) {
    alert('Please enter your phone number.');
    return;
  }
  const personalNumber = numberCallThru.value.trim();
  if(!personalNumber){
    alert('Please enter your phone number.');
    return;
  }
  callThruBtn.disabled = true;
  callThruBtn.innerText = 'Call in progress...';

  fetch('/api/makeCallThru', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ to: number, from: numberFrom, personalNumber: personalNumber })
  })
    .then(res => res.json())
    .then(data => {
      console.log('Call launched', data);
      currentCallSidThru = data.sid;

      callThruBtn.disabled = false;
      callThruBtn.textContent = 'To hang up';

      callThruBtn.removeEventListener('click', makeCallThru);
      callThruBtn.addEventListener('click', hangupCallThru);
    })
    .catch(err => {
      console.error('Error:', err);
      alert('Error while launching the call');

      callThruBtn.disabled = false;
      callThruBtn.innerText = 'Call Thru';
    });
}

async function afficherNumerosEtContacts(urlNumeros) {
  try {
    const res = await fetch(urlNumeros);
    const data = await res.json();

    if (!data.success || !Array.isArray(data.numbers)) {
      phoneBar.innerHTML = '<p>No number found.</p>';
      return;
    }
    phoneBar.innerHTML = '';
    data.numbers.forEach(num => {
      const p = document.createElement('p');
      p.textContent = num;
      p.className = 'phone-number-item';
      p.addEventListener('click', async () => {
        document.querySelectorAll('.phone-number-item').forEach(el => el.classList.remove('active'));
        p.classList.add('active');
        chatList.innerHTML = '';
        await chargerContactsPourNumero(num);
      });
      phoneBar.appendChild(p);
    });

    chatList.innerHTML = '';
    for (const num of data.numbers) {
      await chargerContactsPourNumero(num);
    }

  } catch (err) {
    console.error(err);
    phoneBar.innerHTML = '<p>Loading error.</p>';
  }
}
async function chargerContactsPourNumero(fromNumber) {
  try {
    const url = `/api/getContacts?number=${encodeURIComponent(fromNumber)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const responseData = await response.json();

    if (!responseData.success || !Array.isArray(responseData.contacts)) {
      console.error(`No contacts for ${fromNumber}`);
      return;
    }

    const section = document.createElement('div');
    section.classList.add('twilio-section');

    for (const contact of responseData.contacts) {
      const contactName = await getContactName(contact.number);
      const displayName = contactName || contact.number;

      const item = document.createElement('div');
      item.classList.add('chat-item');

      const lastMessage = contact.lastMessage || '(No message)';
      const date = contact.dateSent
        ? new Date(contact.dateSent).toLocaleString()
        : 'Date unknown';

      item.innerHTML = `
        <strong>${displayName}</strong><br>
        <small>${date}</small><br>
        <span>${lastMessage.slice(0, 30)}...</span>
      `;

      item.addEventListener('click', () => {
        loadHistory(contact.number, fromNumber);
        document.getElementById('twilio-number').value = fromNumber;
        document.getElementById('number').value = contact.number;
      });

      section.appendChild(item);
    }

    chatList.appendChild(section);

  } catch (err) {
    console.error(`Error pour ${fromNumber}:`, err);
  }
}

// --- Click management ---
btnBDH.addEventListener('click', () => {
  afficherNumerosEtContacts('/api/getBdhNumbers');
});

btnBernardson.addEventListener('click', () => {
  afficherNumerosEtContacts('/api/getBernardsonNumbers');
});

// Initial event on page load
// Disable the call button initially
callBtn.disabled = true;
connectToTwilio().then(device => {
    twilioDevice = device;
    if (twilioDevice) {
        callBtn.disabled = false;
        console.log('Bouton d\'appel activé');
    }
});
callBtn.addEventListener('click', () => {
    const phoneNumber = numberInput.value.trim();
    if (phoneNumber) {
        makeCall(phoneNumber);
    } else {
        alert('Please enter a phone number.');
    }
});
callThruBtn.addEventListener('click', makeCallThru);
