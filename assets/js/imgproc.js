
// Simple image-processing helpers (no external libs)
export function getImageData(canvas){
  const ctx = canvas.getContext('2d');
  return ctx.getImageData(0,0,canvas.width,canvas.height);
}

export function rgb2lab(r,g,b){
  // sRGB to CIE Lab (D65) approximate
  function pivot(c){ c/=255; return (c<=0.04045)? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
  let R=pivot(r), G=pivot(g), B=pivot(b);
  let X = R*0.4124 + G*0.3576 + B*0.1805;
  let Y = R*0.2126 + G*0.7152 + B*0.0722;
  let Z = R*0.0193 + G*0.1192 + B*0.9505;
  // Reference white
  X/=0.95047; Y/=1.00000; Z/=1.08883;
  function f(t){ return t>0.008856? Math.cbrt(t) : (7.787*t + 16/116); }
  const fx=f(X), fy=f(Y), fz=f(Z);
  const L = 116*fy - 16;
  const a = 500*(fx - fy);
  const b = 200*(fy - fz);
  return [L,a,b];
}

export function computeStatsLab(imgData, mask){
  const {data,width,height} = imgData; let sumL=0,sumA=0,sumB=0,n=0;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4; if(mask && !mask[y*width+x]) continue;
      const r=data[i], g=data[i+1], b=data[i+2];
      const [L,a,b2]=rgb2lab(r,g,b);
      sumL+=L; sumA+=a; sumB+=b2; n++;
    }
  }
  return {meanL:sumL/n||0, meanA:sumA/n||0, meanB:sumB/n||0};
}

export function localVarianceL(imgData, mask, step=3){
  const {data,width,height} = imgData; let acc=0,n=0;
  for(let y=step;y<height-step;y+=step){
    for(let x=step;x<width-step;x+=step){
      if(mask && !mask[y*width+x]) continue;
      let sum=0, sum2=0, k=0;
      for(let dy=-step;dy<=step;dy++){
        for(let dx=-step;dx<=step;dx++){
          const i=((y+dy)*width+(x+dx))*4; const r=data[i],g=data[i+1],b=data[i+2];
          const L=rgb2lab(r,g,b)[0]; sum+=L; sum2+=L*L; k++;
        }
      }
      const mean=sum/k; const varr=(sum2/k - mean*mean); acc+=Math.max(0,varr); n++;
    }
  }
  return (acc/n)||0;
}

export function laplaceMagnitude(imgData, mask){
  const {data,width,height} = imgData; const k=[[0,1,0],[1,-4,1],[0,1,0]]; let acc=0,n=0;
  for(let y=1;y<height-1;y+=2){
    for(let x=1;x<width-1;x+=2){
      if(mask && !mask[y*width+x]) continue;
      let L=0;
      for(let j=-1;j<=1;j++){
        for(let i=-1;i<=1;i++){
          const p=((y+j)*width+(x+i))*4; const r=data[p],g=data[p+1],b=data[p+2];
          const l=rgb2lab(r,g,b)[0]; L+=l*k[j+1][i+1];
        }
      }
      acc+=Math.abs(L); n++;
    }
  }
  return (acc/n)||0;
}

export function spotIndex(imgData, mask){
  // count pixels significantly darker or lighter than local mean
  const {data,width,height} = imgData; let cnt=0, tot=0;
  const win=4; // small window
  for(let y=win;y<height-win;y+=3){
    for(let x=win;x<width-win;x+=3){
      if(mask && !mask[y*width+x]) continue;
      let sum=0,k=0;
      for(let j=-win;j<=win;j++){
        for(let i=-win;i<=win;i++){
          const p=((y+j)*width+(x+i))*4; const l=rgb2lab(data[p],data[p+1],data[p+2])[0]; sum+=l; k++;
        }
      }
      const mean=sum/k; const p0=((y)*width+(x))*4; const l0=rgb2lab(data[p0],data[p0+1],data[p0+2])[0];
      if(Math.abs(l0-mean)>6) cnt++; tot++;
    }
  }
  return tot? cnt/tot : 0;
}

export function buildOvalMask(w,h){
  // center oval mask similar to face overlay (70% width, 66% height)
  const mask=new Uint8Array(w*h); const cx=w*0.5, cy=h*0.45; const rx=w*0.35, ry=h*0.33;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const nx=(x-cx)/rx; const ny=(y-cy)/ry; const inside=(nx*nx+ny*ny)<=1.0; mask[y*w+x]=inside?1:0;
    }
  }
  return mask;
}
