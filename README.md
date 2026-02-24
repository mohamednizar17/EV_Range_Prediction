# 🚗 EV Range Lab

### Physics-Based EV Range Estimation + Intelligent Model Recommendation

An interactive full-stack web application that estimates electric vehicle driving range using real engineering parameters and suggests real EV models filtered by budget.

Designed to demonstrate **frontend engineering, backend API integration, physics modeling, and secure deployment practices**.

---

## 🌍 Live Demo

>https://mohamednizar17.github.io/EV_Range_Prediction/


---

# 🎯 Project Highlights (For Recruiters)

* ⚡ Built a physics-informed EV consumption model (client-side)
* 🔐 Secure backend architecture to protect API keys
* 🧠 Intelligent range estimation using 10 real-world engineering inputs
* 📊 Real-time metric visualization (efficiency + energy consumption)
* 🔎 Budget-based EV recommendation engine
* 🚀 Deployed frontend + backend (GitHub Pages + Render)

---

# 🛠 Tech Stack

### Frontend

* HTML5
* CSS3 (Custom UI styling)
* Vanilla JavaScript (No frameworks)
* Local Storage API
* Responsive design

### Backend

* Node.js
* Express.js
* OpenRouter API integration
* dotenv for environment variables
* Helmet (security headers)
* CORS protection
* Rate limiting middleware

### Deployment

* GitHub Pages (Frontend)
* Render (Backend API hosting)

---

# 🧮 Engineering Model

The application estimates EV range using:

### 🔢 10 Input Parameters

1. Battery capacity (kWh)
2. Voltage (V)
3. Battery chemistry (LFP / NMC / NCA / LTO)
4. Cell type (Prismatic / Cylindrical / Pouch)
5. Vehicle mass (kg)
6. Drag coefficient (Cd)
7. Frontal area (m²)
8. Drivetrain (FWD / RWD / AWD)
9. Tire type (Eco / Standard / Performance)
10. Ambient temperature (°C)

---

### ⚙️ Model Logic

* Baseline energy consumption at 100 km/h
* Aerodynamic drag force calculation
* Rolling resistance estimation
* Temperature correction factors
* Drivetrain efficiency adjustment
* Tire efficiency modifiers
* Battery chemistry influence
* Voltage scaling effects

Outputs:

* Estimated Range (km / miles)
* Efficiency (km/kWh)
* Wh/km
* kWh/100 km

---

# 🖥 Application Features

* 🎛 Interactive UI with real-time recalculation
* 📈 Visual range gauge
* 🏷 Dynamic factor badges
* 💰 Price range EV filtering (min/max)
* 📦 Curated EV dataset
* ⚡ “Apply Specs” pre-fill feature
* 💾 Save / restore configuration (localStorage)
* 🎲 Randomize input parameters
* 📤 Import / export configuration

---

# 🔐 Secure Chat Assistant Architecture

The AI assistant is integrated via a backend proxy to prevent API key exposure.

## Architecture Flow

User → Frontend → Backend API → OpenRouter → Response → Frontend

### Security Measures

* API key stored only in `.env`
* CORS restricted to frontend origin
* Helmet security headers
* Rate limiting protection
* No secrets exposed client-side

---

# 🚀 How to Run Locally

## Frontend

Open:

```bash
index.html
```

Or run a local server:

```bash
python -m http.server 8000
```

---

## Backend

Inside `Backend/`:

### 1️⃣ Create `.env`

```env
OPENROUTER_API_KEY=your-key
OPENROUTER_SITE=https://your-username.github.io/repo
OPENROUTER_TITLE=EV Range Lab
FRONTEND_ORIGIN=https://your-username.github.io
PORT=3000
```

### 2️⃣ Install + Run

```bash
npm install
npm start
```

---

# 🧪 Testing API Integration

1. Open deployed frontend
2. Open DevTools → Network tab
3. Send a chat message
4. Confirm HTTP 200
5. Validate JSON response:

```json
{
  "reply": "...",
  "model": "..."
}
```

---

# 📊 Why This Project Stands Out

* Demonstrates applied physics in frontend modeling
* Shows full-stack integration
* Implements production-level API security
* Combines engineering + product thinking
* Clean separation of concerns
* Deployment-ready architecture

---

# 📈 Potential Enhancements

* Add machine learning range prediction
* Add battery degradation modeling
* Elevation & terrain simulation
* Convert to React / Next.js
* Dockerize backend
* Add CI/CD pipeline
* Add unit & integration tests

---



