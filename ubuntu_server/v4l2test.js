const wrtc = require('@roamhq/wrtc')
wrtc.getUserMedia({ video: true, audio: true }, (stream) => {
console.log('Got media stream:', stream);
}, (err) => {
console.error('Error accessing media devices:', err);
});