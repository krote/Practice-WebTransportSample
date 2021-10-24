let wt, streamNumber, datagramWriter;

connect.onclick = async ()=> {
    try{
        const url = document.getElementById('url').value;

        wt = new WebTransport(url);
        addToEventLog('Initiating connection...');
        await wt.ready;
        addToEventLog('Connection ready.');

        wt.closed
            .then( ()=> addToEventLog('Connection closed nomary.'))
            .catch( ()=> addToEventLog('Connection closed abruptly.', 'error'));
        
        streamNumber = 1;
        datagramWriter = wt.datagrams.writable.getWriter();

        readDatagrams();
        acceptUnidirectionalStreams();
        document.forms.sending.elements.send.disabled = false;
        document.getElementById('connect').disabled = true;
    }catch(e){
        addToEventLog(`Connection failed. ${e}`, 'error');
    }
}

sendData.onclick = async () => {
    const form = document.forms.sending.elements;
    const rawData = sending.data.value;
    const data = new TextEncoder('utf-8').encode(rawData);
    try{
        switch (form.sendtype.value){
            case 'datagram': {
                await datagramWriter.write(data);
                addToEventLog(`Sent datagram`)
                break;
            }
            case 'unidi': {
                const writable = await wt.createUnidirectionalStream();
                const writer = writable.getWriter();
                await writer.write(data);
                await writer.close();
                addToEventLog(`Sent a unidirectional stream with data: ${rawData}`);
                break;
            }
            case 'bidi': {
                const duplexStream = await wt.createBidirectionalStream();
                const n = streamNumber++;
                readFromIncomingStream(duplexStream.readable, n);

                const writer = duplexStream.writable.getWriter();
                await writer.write(data);
                await writer.close();
                addToEventLog(`Sent bidirectional stream #${n} with data: ${data}`);
                break;
            }
        }
    }catch(e){
        addToEventLog(`Error while sending data: ${e}`, 'error');
    }
}

// Reads datagrams into the event log until EOF is reached
async function readDatagrams(){
    try{
        const decoder = new TextDecoderStream('utf-8');

        for await (const data of wt.datagrams.readable.pipeThrough(decoder)){
            addToEventLog(`Datagram received: ${data}`);
        }
        addToEventLog('Done reading datagrams!');
    }catch(e){
        addToEventLog(`Error while reading datagrams: ${e}`, 'error');
    }
}

async function acceptUnidirectionalStreams(){
    try{
        for await (const readable of wt.incomingUnidirectionalStreams){
            const number = streamNumber++;
            addToEventLog(`New incoming unidirectional stream ${number}`);
            readFromIncomingStream(readable, number);
        }
        addToEventLog('Done accepting unidirectional streams!');
    }catch(e){
        addToEventLog(`Error while accepting streams ${e}`, 'error');
    }
}

function addToEventLog(text, severity = 'info'){
    const log = document.getElementById('event-log');
    const previous = log.lastElementChild;
    const entry = document.createElement('li');
    entry.innerText = text;
    entry.className = `log-${severity}`;
    log.appendChild(entry);

    // If the previous entry in the log was visible, scroll to the new element.
    if( previous &&
        previous.getBoundingClientRect().top < log.getBoundingClientRect().bottom){
            entry.scrollIntoView();
    }
}