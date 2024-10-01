import React, { useEffect, useRef } from 'react';

const TelegramLoginWidget = ({ botName, onAuth }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    containerRef.current.appendChild(script);

    window.onTelegramAuth = (user) => {
      // Сохраняем данные пользователя в localStorage
      localStorage.setItem('telegramUser', JSON.stringify(user));
      onAuth(user);
    };

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botName, onAuth]);

  return <div ref={containerRef}></div>;
};

export default TelegramLoginWidget;