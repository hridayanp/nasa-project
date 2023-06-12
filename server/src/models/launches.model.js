const launchesDatabase = require('./launches.mongo');
const planets = require('./planets.mongo');
const axios = require('axios');

const DEFAULT_FLIGHT_NUMBER = 100;

// launches.set(launch.flightNumber, launch);
const SPACEX_API_URL = 'https://api.spacexdata.com/v4/launches/query';

const populateLaunches = async () => {
  const response = await axios.post(SPACEX_API_URL, {
    query: {},
    options: {
      pagination: false,
      populate: [
        {
          path: 'rocket',
          select: {
            name: 1,
          },
        },
        {
          path: 'payloads',
          select: {
            customers: 1,
          },
        },
      ],
    },
  });

  // const launchDocs = response.data.docs.map((launch) => {
  //   return {
  //     flightNumber: launch.flight_number,
  //     mission: launch.name,
  //     rocket: launch.rocket.name,
  //     launchDate: launch.date_local,
  //     upcoming: launch.upcoming,
  //     success: launch.success,
  //     customers: launch.payloads.flatMap((customer) => {
  //       return customer.customers;
  //     }),
  //   };
  // });

  if (response.status !== 200) {
    console.log('Problem downloading launch data');
    throw new Error('Launch data download failed');
  }

  const launchDocs = response.data.docs;
  for (const launchDoc of launchDocs) {
    const payloads = launchDoc['payloads'];
    const customers = payloads.flatMap((payload) => {
      return payload['customers'];
    });

    const launch = {
      flightNumber: launchDoc['flight_number'],
      mission: launchDoc['name'],
      rocket: launchDoc['rocket']['name'],
      launchDate: launchDoc['date_local'],
      upcoming: launchDoc['upcoming'],
      success: launchDoc['success'],
      customers: customers,
    };

    await saveLaunch(launch);
  }
};

const loadLaunchData = async () => {
  const firstLaunch = await findLaunch({
    flightNumber: 1,
    rocket: 'Falcon 1',
    mission: 'FalconSat',
  });
  console.log('Inside Load launch Data');

  if (firstLaunch) {
    console.log('Launch data already loaded');
  } else {
    console.log('Launch data not loaded');
    populateLaunches();
  }
};

const findLaunch = async (filter) => {
  return await launchesDatabase.findOne(filter);
};

const existsLaunchWithId = async (launchId) => {
  return await launchesDatabase.findOne(
    {
      flightNumber: launchId,
    },
    { _id: 0, __v: 0 }
  );
};

const getLatestFlightNumber = async () => {
  const latestLaunch = await launchesDatabase.findOne().sort('-flightNumber');

  if (!latestLaunch) {
    return DEFAULT_FLIGHT_NUMBER;
  }

  return latestLaunch.flightNumber;
};

const getAllLaunches = async (skip, limit) => {
  return launchesDatabase
    .find({}, { _id: 0, __v: 0 })
    .sort({ flightNumber: 1 })
    .skip(skip)
    .limit(limit);
};

const saveLaunch = async (launch) => {
  await launchesDatabase.findOneAndUpdate(
    {
      flightNumber: launch.flightNumber,
    },
    launch,
    {
      upsert: true,
    }
  );
};

const scheduleNewLaunch = async (launch) => {
  const planet = await planets.findOne({
    keplerName: launch.target,
  });

  if (!planet) {
    throw new Error('No matching planet was found');
  }

  const newFlightNumber = (await getLatestFlightNumber()) + 1;

  const newLaunch = Object.assign(launch, {
    success: true,
    upcoming: true,
    customers: ['NASA', 'ZTM'],
    flightNumber: newFlightNumber,
  });

  await saveLaunch(newLaunch);
};

// const addNewLaunch = (launch) => {
//   latestFlightNumber++;
//   launches.set(
//     launch.flightNumber,
//     Object.assign(launch, {
//       flightNumber: latestFlightNumber,
//       upcoming: true,
//       customers: ['NASA', 'ZTM'],
//       success: true,
//     })
//   );
// };

const abortLaunch = async (launchId) => {
  // const aborted = launches.get(launchId);
  // aborted.upcoming = false;
  // aborted.success = false;
  // return aborted;

  // const aborted =
  return await launchesDatabase.updateOne(
    {
      flightNumber: launchId,
    },
    { upcoming: false, success: false }
  );

  // return aborted.ok === 1 && aborted.nModified === 1;
};

module.exports = {
  loadLaunchData,
  existsLaunchWithId,
  getAllLaunches,
  scheduleNewLaunch,
  abortLaunch,
};
