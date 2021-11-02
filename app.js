const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

let settings = {
  areModulesLoaded: false,
  pathToCscalpFolder: false,
};

const updateSettings = () => {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
};

if (fs.existsSync('settings.json')) {
  settings = fs.readFileSync('settings.json', 'utf8');
  settings = JSON.parse(settings);
} else {
  fs.writeFileSync('settings.json', JSON.stringify(settings));
}

if (!settings.areModulesLoaded) {
  execSync('npm i --loglevel=error');
  settings.areModulesLoaded = true;
  updateSettings();
}

const xml2js = require('xml2js');

const {
  getActiveInstruments,
} = require('./trading-helper/get-active-instruments');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const start = async () => {
  if (!settings.pathToCscalpFolder) {
    return askQuestion('whereCScalpFolder');
  }

  const pathToSettingsFolder = `${settings.pathToCscalpFolder}\\SubApps\\CScalp\\Data\\MVS`;

  if (!fs.existsSync(pathToSettingsFolder)) {
    console.log('Не нашел папку с настройками cscalp');
    return askQuestion('whereCScalpFolder');
  }

  const resultGetActiveInstruments = await getActiveInstruments();

  if (!resultGetActiveInstruments || !resultGetActiveInstruments.status) {
    console.log(resultGetActiveInstruments.message || 'Cant resultGetActiveInstruments');
    return false;
  }

  const filesNames = fs.readdirSync(pathToSettingsFolder);

  await Promise.all(resultGetActiveInstruments.result.map(async instrumentDoc => {
    const halfFromAverageVolume = Math.ceil(instrumentDoc.average_volume_for_last_24_hours / 2);

    let instrumentName = instrumentDoc.name;
    const isFutures = instrumentDoc.is_futures;

    if (isFutures) {
      instrumentName = instrumentName.replace('PERP', '');
    }

    filesNames.forEach(async fileName => {
      if (!fileName.includes(instrumentName)) {
        return true;
      }

      if (isFutures) {
        if (!fileName.includes(`CCUR_FUT.${instrumentName}`)) {
          return true;
        }
      } else {
        if (!fileName.includes(`CCUR.${instrumentName}`)) {
          return true;
        }
      }

      const fileContent = fs.readFileSync(`${pathToSettingsFolder}/${fileName}`, 'utf8');
      const parsedContent = await xml2js.parseStringPromise(fileContent);

      parsedContent.Settings.DOM[0].FilledAt[0].$.Value = halfFromAverageVolume.toString();
      parsedContent.Settings.DOM[0].BigAmount[0].$.Value = halfFromAverageVolume.toString();
      parsedContent.Settings.DOM[0].HugeAmount[0].$.Value = instrumentDoc.average_volume_for_last_24_hours.toString();

      parsedContent.Settings.CLUSTER_PANEL[0].FilledAt[0].$.Value = instrumentDoc.average_volume_for_last_24_hours.toString();

      const builder = new xml2js.Builder();
      const xml = builder.buildObject(parsedContent);
      fs.writeFileSync(`${pathToSettingsFolder}/${fileName}`, xml);
    });
  }));

  console.log('Process was finished');
};

const askQuestion = (nameStep) => {
  if (nameStep === 'whereCScalpFolder') {
    rl.question('Укажите полный путь к папке cscalp\n', userAnswer => {
      if (!userAnswer) {
        console.log('Вы ничего не ввели');
        return askQuestion('whereCScalpFolder');
      }

      if (!fs.existsSync(userAnswer)) {
        console.log('Не нашел папку');
        return askQuestion('whereCScalpFolder');
      }

      settings.pathToCscalpFolder = userAnswer;
      updateSettings();

      return start();
    });
  }
};

start();
