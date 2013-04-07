var camera, renderer, controls, projector, scene, stats, container, plane, composer, effectFXAA, light;

var keyDict = {};
var buttonDict = {};

var postprocessing = { enabled  : true };

var dX = 5000;
var dZ = 5000;

var cameraMoveSpeed = 30;

function loaded () {
	$(".loader").css("opacity", 0);
	setTimeout(function () {
		container.css("opacity", 1);
	}, 500);
}

function init () {
	container = $("#container");

	camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 50, 10000);

	controls = new THREE.OrbitControls(camera);
	controls.addEventListener('change', render);
	// controls.autoRotate = true;

	camera.position.x = 2500;
	camera.position.y = 2500;
	camera.position.z = 2500;

	scene = new THREE.Scene();
	scene.fog = new THREE.FogExp2(0x222222, 0.0001);

	// Model Loader
	// var loader = new THREE.JSONLoader();

	// Projector
	projector = new THREE.Projector();

	// Stats
	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.top = '0px';
	stats.domElement.style.zIndex = 100;
	container.append( stats.domElement );

	// World
	var planeGeo = new THREE.PlaneGeometry(dX, dZ);
	var planeMat = new THREE.MeshPhongMaterial({
		color: 0xffffff * Math.random(),
		side: THREE.DoubleSide
	});
	plane = new THREE.Mesh(planeGeo, planeMat);
	plane.rotation.x = Math.PI/2;
	plane.receiveShadow = true;
	scene.add(plane);

	var group = new THREE.Object3D();

	createTree(group, {
		startPoint: new THREE.Vector3(0,0,0),
		height: 1000,
		widthBot: 50,
		widthTop: 10,
		depth: 2,
		rotMat: new THREE.Matrix4(),
		noise: 10,
		branchNum: 15,
		branchStart: 2/3,
		leavesDensity: 3,
		branchSizeDecay: 1.5,
		branchDensityThreshold: 100,
		branchAngleThreshold: Math.PI/3,
		polyDetail: 20
	});

	scene.add(group);

	// Lights
	light = new THREE.DirectionalLight(0xffffff, 1, 20000);
	light.position.set(0, 1500, 0);
	light.castShadow = true;
	// light.shadowMapBias = 0.001
	light.shadowMapWidth = light.shadowMapHeight = 1024;
	light.shadowCameraVisible = true;
	light.shadowCameraLeft = light.shadowCameraBottom = -1000;
	light.shadowCameraRight = light.shadowCameraTop = 1000;
	// light.shadowMapDarkness = .6;
	scene.add(light);

	//var ambientLight = new THREE.AmbientLight( 0x111111 );
	//scene.add( ambientLight );

	// renderer
	renderer = new THREE.WebGLRenderer({
		antialias: false
	});
	renderer.shadowMapEnabled = true;
	renderer.shadowMapSoft = true;
	renderer.setClearColor(scene.fog.color, 1);
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.setClearColorHex(0x222222, renderer.getClearAlpha());

	container.append(renderer.domElement);

	var renderModel = new THREE.RenderPass( scene, camera );
	var effectBloom = new THREE.BloomPass( 1, 9, 1.0, 1024 );
	var effectCopy = new THREE.ShaderPass( THREE.CopyShader );
	effectFXAA = new THREE.ShaderPass( THREE.FXAAShader );
	var width = window.innerWidth || 2;
	var height = window.innerHeight || 2;
	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / width, 1 / height );
	effectCopy.renderToScreen = true;
	composer = new THREE.EffectComposer( renderer );
	composer.addPass( renderModel );
	composer.addPass( effectFXAA );
	//composer.addPass( effectBloom );
	composer.addPass( effectCopy );

	window.addEventListener('resize', onWindowResize, false);
	renderer.domElement.addEventListener('mousedown', onDocumentMouseDown, false);
	window.addEventListener('keydown', onDocumentKeyDown, false);
	window.addEventListener('keyup', onDocumentKeyUp, false);
}

function createTree (group, data) {

	/*
	startPoint, height, widthBot, widthTop, depth, rotMat, noise, branchNum
	*/

	var trunkGeo = new THREE.CylinderGeometry(data.widthTop, data.widthBot, data.height, data.polyDetail, data.polyDetail, false);
	for (var i = 0; i < trunkGeo.vertices.length; i++) {
		trunkGeo.vertices[i].x += (Math.random() * data.noise) - data.noise/2;
		trunkGeo.vertices[i].y += (Math.random() * data.noise) - data.noise/2;
		trunkGeo.vertices[i].z += (Math.random() * data.noise) - data.noise/2;
	}
	var trunkMat = new THREE.MeshPhongMaterial({
		map: THREE.ImageUtils.loadTexture("/img/bark.jpg"),
		wrapS: THREE.RepeatWrapping,
		wrapT: THREE.RepeatWrapping,
		anisotropy: 16
	});
	var trunk = new THREE.Mesh(trunkGeo, trunkMat);
	//console.log(trunk)
	trunk.receiveShadow = true;
	trunk.castShadow = true;
	trunk.rotation.setEulerFromRotationMatrix(data.rotMat);
	//trunk.rotation.applyMatrix4(rotMat);
	//console.log(trunk.rotation)
	var dirVec = new THREE.Vector3(0,1,0).applyMatrix4(data.rotMat);
	var halfHeight = dirVec.clone().multiplyScalar(data.height/2);
	var trunkPos = new THREE.Vector3().addVectors(data.startPoint, halfHeight);
	trunk.position.copy(trunkPos);
	group.add(trunk)
	//console.log(trunk)
	if (data.depth > 0) {
		var usedVals = [];
		var usedAngles = [];
		for (var i = 0; i < data.branchNum; i++) {

			var trial = false;
			var distUpTree;
			var numLoops = 0;
			while (!trial) {
				var closeCheck = false;
				distUpTree = Math.random() * (data.height * data.branchStart);
				distUpTree += (1 - data.branchStart) * data.height;
				for (var j = 0; j < usedVals.length; j++) {
					if (Math.abs(distUpTree - usedVals[j]) < data.branchDensityThreshold) {
						closeCheck = true;
					}
				}
				if (closeCheck && numLoops < 10) {
					//do nothing and generate again
				} else {
					trial = true;
				}
				numLoops++;
			}
			usedVals.push(distUpTree)

			trial = false;
			var rotAroundTree;
			numLoops = 0;
			while (!trial) {
				var closeCheck = false;
				rotAroundTree = Math.random() * Math.PI * 2;
				for (var j = 0; j < usedAngles.length; j++) {
					if (Math.abs(rotAroundTree - usedAngles[j]) < data.branchAngleThreshold) {
						closeCheck = true;
					}
				}
				if (closeCheck && numLoops < 10) {
					//do nothing and generate again
				} else {
					trial = true;
				}
				numLoops++;
			}
			usedAngles.push(rotAroundTree)

			var distUpTreeVec = dirVec.clone().multiplyScalar(distUpTree);
			//var rotAroundTree = Math.random() * Math.PI * 2;



			var newRotMat = data.rotMat.clone();



			var rotVec = new THREE.Vector3().crossVectors(new THREE.Vector3(1,0,0), dirVec).normalize();

			var normVec = new THREE.Vector3().crossVectors(dirVec, rotVec).normalize();
			


			newRotMat.rotateByAxis(rotVec, Math.random() * Math.PI/4 + Math.PI/4);
			
			var rotMatrix = new THREE.Matrix4().makeRotationAxis(normVec, Math.PI/8);

			var rotVecCopy = rotVec.copy().applyMatrix4(rotMatrix);

			if (rotVecCopy.y - rotVec.y < 0){
				newRotMat.rotateByAxis(normVec, Math.random() * (-Math.PI/6));
			}
			else{
				newRotMat.rotateByAxis(normVec, Math.random() * (Math.PI/6));
			}



			var rotAxis = dirVec.clone();
			rotAxis.applyMatrix4(newRotMat);
			newRotMat.rotateByAxis(rotAxis, rotAroundTree);

			var branchScalar = ((1-distUpTree/data.height) + 0.5)/1.5

			createTree(group, {
				startPoint: new THREE.Vector3().addVectors(data.startPoint, distUpTreeVec),
				height: data.height/(data.branchSizeDecay + Math.random()) * branchScalar,
				widthBot: data.widthBot/(data.branchSizeDecay + Math.random()) * branchScalar,
				widthTop: data.widthTop/(data.branchSizeDecay + Math.random()) * branchScalar,
				depth: data.depth - 1,
				rotMat: newRotMat,
				noise: data.noise/(2 + Math.random()),
				branchNum: Math.floor(data.branchNum/(2 + Math.random())),
				branchStart: data.branchStart,
				leavesDensity: data.leavesDensity,
				branchSizeDecay: data.branchSizeDecay,
				branchDensityThreshold: data.branchDensityThreshold/1.5,
				branchAngleThreshold: data.branchAngleThreshold,
				polyDetail: Math.ceil(data.polyDetail/2)
			});
		}
	} else {
		for (var i = 0; i < data.leavesDensity; i++) {
			var distUpTree = Math.random() * data.height;
			var distUpTreeVec = dirVec.clone().multiplyScalar(distUpTree);
			var leaveSize = Math.random() * 50 + 200;
			var leavesGeo = new THREE.PlaneGeometry(leaveSize, leaveSize);
			var leavesMat = new THREE.MeshPhongMaterial({
				map: THREE.ImageUtils.loadTexture("/img/leaves.png"),
				transparent: true,
				side: THREE.DoubleSide,
				depthWrite: false,
				alphaTest: 0.5
				//blending: THREE.AdditiveBlending
			});
			var leaves = new THREE.Mesh(leavesGeo, leavesMat);
			leaves.rotation.x = Math.random() * Math.PI * 2;
			leaves.rotation.y = Math.random() * Math.PI * 2;
			leaves.rotation.z = Math.random() * Math.PI * 2;
			leaves.position.copy(new THREE.Vector3().addVectors(data.startPoint, distUpTreeVec));
			leaves.castShadow = true;

			// leaves.customDepthMaterial = new THREE.ShaderMaterial({
			// 	uniforms: {
			// 		'texture': {type: 't', value:0, texture: []}
			// 	},
			// 	vertexShader: [
			// 		THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
			// 		"void main() {",
			// 			"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
			// 			THREE.ShaderChunk[ "morphtarget_vertex" ],
			// 			THREE.ShaderChunk[ "default_vertex" ],
			// 		"}"
			// 	].join("\n"),
			// 	fragmentShader: [
			// 		"uniform sample2D texture;",
			// 		"vec4 pack_depth( const in float depth ) {",
			// 			"const vec4 bit_shift = vec4( 256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0 );",
			// 			"const vec4 bit_mask  = vec4( 0.0, 1.0 / 256.0, 1.0 / 256.0, 1.0 / 256.0 );",
			// 			"vec4 res = fract( depth * bit_shift );",
			// 			"res -= res.xxyz * bit_mask;",
			// 			"return res;",
			// 		"}",
			// 		"void main() {",
			// 			"if (texture.a < 0.5)",
			// 				"discard;",
			// 			"gl_FragData[ 0 ] = pack_depth( gl_FragCoord.z );",
			// 		"}"
			// 	].join("\n")
			// });
			// console.log(leaves.customDepthMaterial)

			// leaves.castShadow = true;
			// leaves.receiveShadow = true;
			//group.add(leaves); //LLLLLLLLLLLLLLLLLLLLLEEEEEEEEEEEEEEEEEEEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVVVVVVVVVVVVEEEEEEEEEESSSSSSSSSS
			// var moveAmount = Math.random() * Math.PI/45;
			// var timer = Math.random() * 5000;
			// var tween = new TWEEN.Tween(leaves.rotation)
			// 	.to( { x: "+"+moveAmount, y: "+"+moveAmount, z: "+"+moveAmount }, 1000)
			// 	.easing(TWEEN.Easing.Quintic.InOut)
			// 	.start()

			// var tweenBack = new TWEEN.Tween(leaves.rotation)
			// 	.to( { x: "-"+moveAmount, y: "-"+moveAmount, z: "-"+moveAmount }, 1000)
			// 	.easing(TWEEN.Easing.Quintic.InOut)
			// 	.start();

			// tween.chain(tweenBack);
			// tweenBack.chain(tween);

			// setTimeout(function() {
			// 	tween.start();
			// }, timer);
		}
	}
}

function onWindowResize () {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

	effectFXAA.uniforms[ 'resolution' ].value.set( 1 / window.innerWidth, 1 / window.innerHeight );

	composer.reset();
}

function distFrom (p1, p2) {
	return Math.sqrt(Math.pow((p1.x-p2.x),2) + Math.pow((p1.y-p2.y),2) + Math.pow((p1.z-p2.z),2));
}

function midPoint (p1, p2) {
	return {x: (p1.x+p2.x)/2, y: (p1.y+p2.y)/2, z: (p1.z+p2.z)/2};
}

function animate () {
	requestAnimationFrame(animate);
	render();
	controls.update();
	stats.update();

	keyControl();

	TWEEN.update();
}

function render () {
	renderer.clear();
	composer.render();
}

function keyControl () {
	if (keyDict["37"]) {
		light.position.x -= cameraMoveSpeed;
	}
	if (keyDict["39"]) {
		light.position.x += cameraMoveSpeed;
	}
	if (keyDict["38"]) {
		light.position.z += cameraMoveSpeed;
	}
	if (keyDict["40"]) {
		light.position.z -= cameraMoveSpeed;
	}
	if (keyDict["16"]) {
		light.position.y += cameraMoveSpeed;
	}
	if (keyDict["32"]) {
		light.position.y -= cameraMoveSpeed;
	}
}

function onDocumentMouseDown (event) {
	if (event.button == 0) {
		event.preventDefault();
	}
}

function onDocumentKeyDown (event) {
	keyDict[event.keyCode] = true;
}

function onDocumentKeyUp (event) {
	keyDict[event.keyCode] = false;
}


if (!Detector.webgl) {
	Detector.addGetWebGLMessage();
} else {
	init();
	animate();
	loaded();
}