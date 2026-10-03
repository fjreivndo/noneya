class Base { constructor(){ const p = new Proxy({}, {get:(t,k)=> k==='show' ? ()=>Promise.resolve({canceled:true}) : ()=>p}); return p; } }
export class ActionFormData extends Base {}
export class ModalFormData extends Base {}
export class MessageFormData extends Base {}
