import { io } from "socket.io-client";

// const socket = io("http://localhost:5000",{
//     withCredentials : true
// }); 
// Change to your backend URL when deployed


const socket = io("http://localhost:5000", {
    withCredentials: true
}); // Change to your backend URL when deployed

export default socket;
