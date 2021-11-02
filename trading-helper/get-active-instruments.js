const axios = require('axios');

const getActiveInstruments = async () => {
  const responseGetData = await axios({
    method: 'get',
    url: 'http://91.240.242.90/api/instruments/active',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return {
    status: true,
    result: responseGetData.data,
  };
};

module.exports = {
  getActiveInstruments,
};
