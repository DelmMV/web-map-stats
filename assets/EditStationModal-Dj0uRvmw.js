import{r as a,j as e,M as k,a as y,b as M,c as v,d as T,V as H,F as n,S as b,C as B,e as E,T as F,B as j}from"./index-Dape29UY.js";import{M as I,a as U}from"./chunk-RAWN7VJ3-DUTKW15K.js";import{F as t,I as L}from"./chunk-6CVSDS6C-hsWb2wW9.js";import{H as P}from"./chunk-3ASUQ6PA-BDYvKFUx.js";import{T as V}from"./chunk-4IH3O7BJ-TOE2q0K3.js";const q=({isOpen:p,onClose:l,onUpdate:f,station:r})=>{const[d,i]=a.useState((r==null?void 0:r.is24Hours)||!1),[h,x]=a.useState((r==null?void 0:r.comment)||""),[C,m]=a.useState(null),[o,u]=a.useState((r==null?void 0:r.markerType)||"charging"),[c,g]=a.useState(!1);a.useEffect(()=>{r&&(i(r.is24Hours||!1),x(r.comment||""),u(r.markerType||"charging"),m(null))},[r]);const S=async()=>{if(!c){g(!0);try{await f({is24Hours:d,comment:h,photo:C,markerType:o}),l()}catch(s){console.error("Error updating station:",s)}finally{g(!1)}}};return e.jsxs(k,{isOpen:p,onClose:l,children:[e.jsx(y,{}),e.jsxs(I,{margin:2,children:[e.jsx(M,{children:"Редактировать место"}),e.jsx(v,{}),e.jsx(T,{children:e.jsxs(H,{spacing:4,children:[e.jsxs(n,{children:[e.jsx(t,{children:"Тип метки"}),e.jsxs(P,{children:[e.jsxs(b,{value:o,onChange:s=>u(s.target.value),children:[e.jsx("option",{value:"charging",children:"Обычная розетка"}),e.jsx("option",{value:"chargingAuto",children:"Автомобильная зарядка"}),e.jsx("option",{value:"danger",children:"Опасное место"}),e.jsx("option",{value:"chat",children:"Разговорчики"})]}),o==="charging"&&e.jsx(B,{isChecked:d,onChange:s=>i(s.target.checked),children:"Ночная"})]})]}),e.jsxs(n,{children:[e.jsx(t,{children:"Комментарий"}),e.jsx(V,{value:h,onChange:s=>x(s.target.value),placeholder:"Опишите место"})]}),e.jsxs(n,{children:[e.jsx(t,{children:"Фото"}),e.jsx(L,{type:"file",accept:"image/*",onChange:s=>m(s.target.files[0])})]}),r&&r.photo&&e.jsxs(E,{children:[e.jsx(F,{children:"Текущее фото:"}),e.jsx("img",{src:r.photo,alt:"Current",style:{maxWidth:"100px",maxHeight:"100px"}})]})]})}),e.jsxs(U,{children:[e.jsx(j,{colorScheme:"blue",mr:3,onClick:S,isLoading:c,loadingText:"Обновление...",disabled:c,children:"Обновить"}),e.jsx(j,{variant:"ghost",onClick:l,children:"Отмена"})]})]})]})};export{q as default};
