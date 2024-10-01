import { useReducer } from 'react';

function routesReducer(state, action) {
  switch (action.type) {
    case 'SET_ROUTES':
      return { 
        ...state, 
        data: action.payload.data, 
        distances: action.payload.distances,
        visibleSessions: Object.keys(action.payload.data).reduce((acc, sessionId) => {
          acc[sessionId] = true;
          return acc;
        }, {})
      };
    case 'CLEAR_ROUTES':
      return { data: {}, distances: {}, visibleSessions: {} };
    case 'TOGGLE_SESSION':
      return {
        ...state,
        visibleSessions: {
          ...state.visibleSessions,
          [action.payload]: !state.visibleSessions[action.payload]
        }
      };
    default:
      return state;
  }
}

export default routesReducer;