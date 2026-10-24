export function printBusinessReceipt(format:'thermal'|'a4'){
 const source=document.getElementById('pos-print-receipt');if(!source)return;
 const root=document.createElement('div');root.id='pos-print-root';root.append(source.cloneNode(true));document.body.append(root);document.body.dataset['posPrint']=format;
 try{window.print();}finally{root.remove();delete document.body.dataset['posPrint'];}
}