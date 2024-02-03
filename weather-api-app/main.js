
const API_KEY = "e4638dc1cc7874137aa1648f0014ee9a";//give your own api key here

const Days_of_the_week = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
let selectedCityText;
let selectedCity;

const getCitiesUsingGeolocation = async(searchText) => {
    const response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${searchText}&limit=5&appid=${API_KEY}`);
    return response.json();
}

const getCurrentWeatherData = async ({ lat, lon, name:city}) => {
    const url = lat && lon ? `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric` : `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${API_KEY}&units=metric`;
    const response = await fetch(url);   
    return response.json()
}

const getHourlyForecast = async ({ name: city }) => {
    const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${API_KEY}&units=metric`);
    const data = await response.json();
    return data.list.map(forecast => {
        const { main: { temp, temp_max, temp_min }, dt, dt_txt, weather: [{ description, icon }] } = forecast;
        return { temp, temp_max, temp_min, dt, dt_txt, description, icon }
    })
}


const formatTemperature = (temp) => `${temp?.toFixed(1)}°`;
const createIconUrl = (icon) => `https://openweathermap.org/img/wn/${icon}@2x.png`

const loadcurrentForecast = ({ name, main: { temp, temp_max, temp_min }, weather: [{ description }] }) => {
    const currentForecastElement = document.getElementById("current-forecast");
    currentForecastElement.querySelector(".city").textContent = name;
    currentForecastElement.querySelector(".temp").textContent = formatTemperature(temp);
    currentForecastElement.querySelector(".description").textContent = description;
    currentForecastElement.querySelector(".min-max-temp").textContent = `H:${formatTemperature(temp_max)} L:${formatTemperature(temp_min)}`;
}


const loadHourlyForecast = ({ main: { temp: tempNow }, weather: [{ icon: iconNow }] }, hourlyForecast) => {
    const timeformatter=Intl.DateTimeFormat("en", {
        hour12:true,hour:"numeric"
    })
    let dataFor12Hours = hourlyForecast.slice(2, 14); // 12 entries
    const hourlyContainer = document.querySelector(".hourly-container");
    let innerHTMLString = `<article>
    <h3 class="time">Now</h3>
    <img class="icon" src="${createIconUrl(iconNow)}"  />
    <p class="hourly-temp">${formatTemperature(tempNow)}</p>
  </article>`;

    for (let { temp, icon, dt_txt } of dataFor12Hours) {

        innerHTMLString += `<article>
        <h3 class="time">${timeformatter.format(new Date(dt_txt))}</h3>
        <img class="icon" src="${createIconUrl(icon)}" />
        <p class="hourly-temp">${formatTemperature(temp)}</p>
      </article>`
    }
    hourlyContainer.innerHTML = innerHTMLString;

}

const calculateDayWiseForecast=(hourlyForecast) => {
    let dayWiseForecast = new Map();
    for (let forecast of hourlyForecast) {
        const [date] = forecast.dt_txt.split(" ");
        const dayOfTheWeek = Days_of_the_week[new Date(date).getDay()];
        if (dayWiseForecast.has(dayOfTheWeek)) {
            let forecastForTheDay = dayWiseForecast.get(dayOfTheWeek);
            forecastForTheDay.push(forecast);
            dayWiseForecast.set(dayOfTheWeek, forecastForTheDay);
        }
        else {
            dayWiseForecast.set(dayOfTheWeek, [forecast]);
        }
    }
    for (let [key, value] of dayWiseForecast) {
        let temp_min = Math.min(...Array.from(value, val => val.temp_min));
        let temp_max = Math.max(...Array.from(value, val => val.temp_max));
       
        dayWiseForecast.set(key, { temp_min, temp_max, icon: value.find(v => v.icon).icon });
    }
    return dayWiseForecast;
}

const loadFiveDayForecast = (hourlyForecast) => {
    const dayWiseForecast = calculateDayWiseForecast(hourlyForecast);
    const container = document.querySelector(".five-day-forecast-container");
    let dayWiseInfo = "";
    Array.from(dayWiseForecast).map(([day, { temp_max, temp_min, icon }], index) => {

        if (index < 5) {
            dayWiseInfo += `<article class="day-wise-forecast">
            <h3 class="day"> ${index === 0 ? "today" : day}</h3>
            <img class="icon" src="${createIconUrl(icon)}" alt="icon for the forecast" />
            <p class="min-temp">${formatTemperature(temp_min)}</p>
            <p class="max-temp">${formatTemperature(temp_max)}</p>
          </article>`
        }
    
    });
    container.innerHTML = dayWiseInfo;
}

const loadFeelsLike = ({ main: { feels_like } }) => {
    let container = document.querySelector("#feels-like");
    container.querySelector(".feels-like-temp").textContent = formatTemperature(feels_like);
}

const loadHumidity = ({ main: { humidity } }) => {
    let container = document.querySelector("#humidity");
    container.querySelector(".humidity-value").textContent = `${humidity}%`;
}

const loadForecastUsingGeoLocation = () => {
    navigator.geolocation.getCurrentPosition(({ coords }) => {
        const { latitude: lat, longitude: lon } = coords;
        selectedCity={ lat, lon };
        loadData();
    },error=>console.log(error))
}

const loadData = async() => {
    const currentWeather = await getCurrentWeatherData(selectedCity);
    loadcurrentForecast(currentWeather);
    const hourlyForecast = await getHourlyForecast(currentWeather);
    loadHourlyForecast(currentWeather, hourlyForecast);
    loadFiveDayForecast(hourlyForecast);
    loadFeelsLike(currentWeather);
    loadHumidity(currentWeather);
    loadBackgroundChanger(currentWeather);
    
}

function debounce(func) {
    let timer;
    return (...args) => {
        clearTimeout(timer); // clear existing timer
        // create a new time till the user is typing
        timer = setTimeout(() => {
            func.apply(this,args)
        },500);
    }
}

const onSearchChange = async(event) => {
    let { value } = event.target;
    if (!value) {
        selectedCity = null;
        selectedCityText = "";
    }
    if (value && (selectedCityText !== value)) {
        const listOfCities = await getCitiesUsingGeolocation(value);
        let options = "";
        for (let { lat, lon, name, state, country } of listOfCities) {
            options += `<option data-city-details='${JSON.stringify({ lat, lon, name })}' value="${name}, ${state}, ${country}"></option>`;
            console.log(state);
        }
        document.querySelector("#cities").innerHTML = options;
        
    }
}

const handleCitySelection = (event) => {
    selectedCityText = event.target.value;
    let options = document.querySelectorAll("#cities > option");
    if (options?.length) {
        let selectedOption = Array.from(options).find(opt => opt.value === selectedCityText);
        selectedCity = JSON.parse(selectedOption.getAttribute("data-city-details"));
        loadData();
    }

}

const debounceSearch=debounce((event)=>onSearchChange(event))

document.addEventListener("DOMContentLoaded", async () => {

    loadForecastUsingGeoLocation();
    const searchInput = document.querySelector("#search");
    searchInput.addEventListener("input", debounceSearch);
    searchInput.addEventListener("change",handleCitySelection)

    
})


const loadBackgroundChanger = ({ weather: [{ description }] }) => {
    console.log(description);
    let backgroundImage = document.getElementById("background-video");
    
    if (description == "thunderstorm with light rain" || description== "thunderstorm with rain" || description=="thunderstorm with heavy rain" || description=="thunderstorm with heavy drizzle" || description=="thunderstorm with heavy drizzle" || description=="	thunderstorm with light drizzle") {
           
            backgroundImage.setAttribute("src", "videos/thunderstormrain.mp4");
        }
    else if (description === "ragged thunderstorm" || description=="heavy thunderstorm" || description=="thunderstorm" || description=="	light thunderstorm") {
        backgroundImage.setAttribute("src","videos/thunderstorm1.mp4");
    
    }
    else if (description == "light intensity drizzle rain" || description=="drizzle rain" || description=="heavy intensity drizzle rain" || description=="shower rain and drizzle" || description=="heavy shower rain and drizzle") {
        backgroundImage.setAttribute("src", "videos/drizzle.mp4");
    }
    else if(description=="shower drizzle" || description=="	heavy intensity drizzle" || description=="drizzle" || description=="light intensity drizzle"){
        backgroundImage.setAttribute("src", "videos/drizzle1.mp4");
    }
    else if (description == "light rain" || description == "moderate rain" || description == "light intensity shower rain" || description == "shower rain") {
        backgroundImage.setAttribute("src", "videos/rain1.mp4");
    }
    else if (description == "heavy intensity rain" || description == "very heavy rain" || description == "extreme rain" || description == "freezing rain" || description == "	heavy intensity shower rain" || description == "ragged shower rain") {
        backgroundImage.setAttribute("src", "videos/rain2.MP4");
    }
    else if (description == "light snow" || description == "snow" || description == "snow" || description == "heavy snow" || description == "sleet" || description == "light shower sleet" || description == "	shower sleet") {
        backgroundImage.setAttribute("src", "videos/snow1.mp4");
    }
    else if (description == "light rain and snow" || description == "rain and snow" || description == "light shower snow" || description == "shower snow" || description == "heavy shower snow") {
        backgroundImage.setAttribute("src", "videos/snow2.mp4");
    }
    else if (description == "mist" || description == "fog" || description == "haze" || description == "tornado") {
        backgroundImage.setAttribute("src", "videos/fog.mp4");
    }
    else if (description == "smoke" || description == "sand" || description == "dust whirls" || description == "sand" || description == "dust" || description == "volcanic ash" || description == "squalls") {
        backgroundImage.setAttribute("src", "videos/smoke.mp4");
    }
    else if (description == "clear sky") {
        backgroundImage.setAttribute("src", "videos/clearsky.mp4");
    }
    else if (description == "few clouds" || description == "overcast clouds") {
        backgroundImage.setAttribute("src", "videos/clouds3.mp4");
    }
    else if(description == "scattered clouds"){
        backgroundImage.setAttribute("src", "videos/clouds1.mp4");
    }
    else if (description == "broken clouds") {
        backgroundImage.setAttribute("src", "videos/clouds2.mp4");
    }
 }
