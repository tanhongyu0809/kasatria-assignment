import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---- Configuration ----
// USER MUST REPLACE THESE WITH ACTUAL VALUES
const GOOGLE_API_KEY = 'AIzaSyDZJ1_lt-EWt5YTeVakTHpTr_uNq5ght2Q';
const SPREADSHEET_ID = '13gGmDWcx35vWY4Fp6C9jCcccHs0PaAp8LSsAgJ3jthY';
const RANGE = "'Data Template'!A2:F201";

// ---- State ----
let tableData = [];
let camera, scene, renderer, controls;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

// Listen for login success event from index.html
document.addEventListener('google-login-success', () => {
	console.log("Encoded JWT ID token: " + window.googleCredentialResponse.credential);
	document.getElementById('loginOverlay').style.display = 'none';
	fetchData();
});

async function fetchData() {
	try {
		const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${GOOGLE_API_KEY}`;
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error('Failed to fetch data from Google Sheets');
		}
		const json = await response.json();
		if (!json.values || json.values.length === 0) {
			throw new Error('No data found in spreadsheet');
		}
		tableData = json.values.map((row, index) => ({
			index: index,
			name: row[0] || 'Unknown',
			photo: row[1] || 'https://via.placeholder.com/80',
			age: row[2] || '-',
			country: row[3] || '-',
			interest: row[4] || '-',
			netWorth: row[5] ? parseFloat(row[5].replace(/[\$,]/g, '')) : 0
		}));

		init();
		animate();
	} catch (error) {
		alert('Error loading data: ' + error.message + '\n\nPlease ensure you have replaced GOOGLE_API_KEY and SPREADSHEET_ID in app.js.');
		console.error(error);
	}
}

function init() {
	camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
	camera.position.z = 3000;

	scene = new THREE.Scene();

	for (let i = 0; i < tableData.length; i++) {
		const item = tableData[i];

		const element = document.createElement('div');
		element.className = 'element';

		let hexColor = '#007F7F'; // default
		if (item.netWorth > 200000) {
			hexColor = '#3A9F48'; // Green
		} else if (item.netWorth > 100000) {
			hexColor = '#FDCA35'; // Orange
		} else {
			hexColor = '#EF3022'; // Red
		}
		element.style.border = `2px solid ${hexColor}`;
		element.style.boxShadow = `0px 0px 12px ${hexColor}`;
		element.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';

		element.innerHTML = `
			<div class="header">
				<span>${item.country}</span>
				<span>${item.age}</span>
			</div>
			<div class="photo" style="background-image: url('${item.photo}')"></div>
			<div class="footer">
				<div class="name">${item.name}</div>
				<div class="interest">${item.interest}</div>
			</div>
		`;

		const objectCSS = new CSS3DObject(element);
		objectCSS.position.x = Math.random() * 4000 - 2000;
		objectCSS.position.y = Math.random() * 4000 - 2000;
		objectCSS.position.z = Math.random() * 4000 - 2000;
		scene.add(objectCSS);
		objects.push(objectCSS);
	}

	// 1. Table: 20x10
	for (let i = 0; i < objects.length; i++) {
		const target = new THREE.Object3D();
		target.position.x = ((i % 20) * 160) - 1520; // 20 cols
		target.position.y = - (Math.floor(i / 20) * 200) + 900; // 10 rows
		targets.table.push(target);
	}

	// 2. Sphere
	const vector = new THREE.Vector3();
	for (let i = 0; i < objects.length; i++) {
		const phi = Math.acos(- 1 + (2 * i) / objects.length);
		const theta = Math.sqrt(objects.length * Math.PI) * phi;

		const target = new THREE.Object3D();
		target.position.setFromSphericalCoords(800, phi, theta);
		vector.copy(target.position).multiplyScalar(2);
		target.lookAt(vector);
		targets.sphere.push(target);
	}

	// 3. Double Helix
	for (let i = 0; i < objects.length; i++) {
		const strandIndex = Math.floor(i / 2); // 100 items per strand
		const isSecondStrand = i % 2 !== 0;
		const offset = isSecondStrand ? Math.PI : 0;

		const theta = strandIndex * 0.175 + offset;
		const y = - (strandIndex * 16) + 800; // Height spread

		const target = new THREE.Object3D();
		target.position.setFromCylindricalCoords(900, theta, y);
		vector.x = target.position.x * 2;
		vector.y = target.position.y;
		vector.z = target.position.z * 2;
		target.lookAt(vector);
		targets.helix.push(target);
	}

	// 4. Grid: 5x4x10 (Image C requires grid arrangement)
	for (let i = 0; i < objects.length; i++) {
		const target = new THREE.Object3D();
		// Layer calculation
		const layer = Math.floor(i / 20); // 10 layers deep (0 to 9)
		const layerIndex = i % 20; // 20 items per layer

		// 5 cols x 4 rows per layer
		target.position.x = ((layerIndex % 5) * 400) - 800;
		target.position.y = (- (Math.floor(layerIndex / 5)) * 400) + 600;
		target.position.z = (layer * -1000) + 4500; // start near camera, go deep

		targets.grid.push(target);
	}

	renderer = new CSS3DRenderer();
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.getElementById('container').appendChild(renderer.domElement);

	controls = new TrackballControls(camera, renderer.domElement);
	controls.minDistance = 500;
	controls.maxDistance = 6000;
	controls.addEventListener('change', render);

	document.getElementById('table').addEventListener('click', function () { transform(targets.table, 2000); });
	document.getElementById('sphere').addEventListener('click', function () { transform(targets.sphere, 2000); });
	document.getElementById('helix').addEventListener('click', function () { transform(targets.helix, 2000); });
	document.getElementById('grid').addEventListener('click', function () { transform(targets.grid, 2000); });

	transform(targets.table, 2000);

	window.addEventListener('resize', onWindowResize);
}

function transform(targets, duration) {
	TWEEN.removeAll();
	for (let i = 0; i < objects.length; i++) {
		const object = objects[i];
		const target = targets[i];

		new TWEEN.Tween(object.position)
			.to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration)
			.easing(TWEEN.Easing.Exponential.InOut)
			.start();

		new TWEEN.Tween(object.rotation)
			.to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration)
			.easing(TWEEN.Easing.Exponential.InOut)
			.start();
	}
	new TWEEN.Tween(this)
		.to({}, duration * 2)
		.onUpdate(render)
		.start();
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	render();
}

function animate() {
	requestAnimationFrame(animate);
	TWEEN.update();
	controls.update();
}

function render() {
	renderer.render(scene, camera);
}
