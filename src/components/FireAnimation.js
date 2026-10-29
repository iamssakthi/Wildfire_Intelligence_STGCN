import { useEffect,useState } from "react";
import { Circle } from "react-leaflet";

export default function FireAnimation({fires}){

const [radius,setRadius] = useState(300);

useEffect(()=>{

const interval = setInterval(()=>{

setRadius(r=>{

if(r>2000) return 300;

return r+200;

});

},700);

return ()=>clearInterval(interval);

},[]);

return(

fires.map((f,i)=>(

<Circle
key={i}
center={[f.lat,f.lon]}
radius={radius}
pathOptions={{
color:"orange",
fillColor:"red",
fillOpacity:0.25
}}
/>

))

);

}