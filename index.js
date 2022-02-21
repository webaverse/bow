import * as THREE from 'three';
import metaversefile from 'metaversefile';
// import { clamp } from 'three/src/math/MathUtils.js';
const {useApp, useFrame, useActivate, useWear, useUse, useLocalPlayer, usePhysics, useScene, getNextInstanceId, getAppByPhysicsId, useWorld, useDefaultModules, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

/* const localVector = new THREE.Vector3();
const localMatrix = new THREE.Matrix4();

const upVector = new THREE.Vector3(0, 1, 0);
const z180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const muzzleOffset = new THREE.Vector3(0, 0.1, 0.25);
const muzzleFlashTime = 300;
const bulletSparkTime = 300; */

const localVector = new THREE.Vector3();

const rightQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2);
const emptyArray = [];
const fnEmptyArray = () => emptyArray;

export default e => {
  const app = useApp();
  app.name = 'bow';

  const physics = usePhysics();
  const scene = useScene();

  // const textureLoader = new THREE.TextureLoader();

  let bowApp = null;
  const arrowApps = [];
  e.waitUntil((async () => {
    {
      let u2 = `${baseUrl}bow.glb`;
      const m = await metaversefile.import(u2);
      bowApp = metaversefile.createApp({
        name: u2,
      });
      bowApp.position.copy(app.position);
      bowApp.quaternion.copy(app.quaternion);
      bowApp.scale.copy(app.scale);
      bowApp.updateMatrixWorld();
      bowApp.name = 'bow';
      bowApp.getPhysicsObjectsOriginal = bowApp.getPhysicsObjects;
      bowApp.getPhysicsObjects = fnEmptyArray;
      
      const components = [
        {
          "key": "instanceId",
          "value": getNextInstanceId(),
        },
        {
          "key": "contentId",
          "value": u2,
        },
        {
          "key": "physics",
          "value": true,
        },
        {
          "key": "wear",
          "value": {
            "boneAttachment": "rightHand",
            "position": [0, 0, 0],
            "quaternion": [0.7071067811865475, 0, 0, 0.7071067811865476],
            "scale": [1, 1, 1]
          }
        },
        {
          "key": "aim",
          "value": {}
        },
        {
          "key": "use",
          "value": {
            "ik": "pistol"
          }
        }
      ];
      
      for (const {key, value} of components) {
        bowApp.setComponent(key, value);
      }
      await bowApp.addModule(m);
      scene.add(bowApp);

      // window.bowApp = bowApp;
      const arrowTemplateMesh = bowApp.getObjectByName('Arrow'); // bowApp.getModule('arrowTemplate');
      arrowTemplateMesh.parent.remove(arrowTemplateMesh);

      const _createArrowApp = () => {
        const arrowApp = metaversefile.createApp({
          name: 'arrow',
        });

        const arrowMesh = arrowTemplateMesh.clone();
        arrowMesh.quaternion.premultiply(rightQuaternion);
        arrowMesh.frustumCulled = false;
        arrowApp.add(arrowMesh);

        arrowApp.velocity = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(
            new THREE.Quaternion()
              .setFromRotationMatrix(bowApp.matrixWorld)
              .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2))
          );
        
        arrowApp.updatePhysics = (timestamp, timeDiff) => {
          const timeDiffS = timeDiff / 1000;
          arrowApp.position.add(localVector.copy(arrowApp.velocity).multiplyScalar(timeDiffS));
          // console.log('add', arrowApp.id, arrowApp.position.toArray().join(','), localVector.toArray().join(','));
          arrowApp.updateMatrixWorld();
        };

        return arrowApp;
      };

      bowApp.addEventListener('use', e => {
        console.log('got bow use', bowApp);
        const arrowApp = _createArrowApp();
        
        scene.add(arrowApp);
        arrowApp.position.copy(bowApp.position);
        arrowApp.quaternion.copy(bowApp.quaternion);
        // arrowApp.scale.copy(bowApp.scale);
        arrowApp.updateMatrixWorld();
        arrowApps.push(arrowApp);
      });
    }
  })());
  
  app.getPhysicsObjects = () => {
    return bowApp ? bowApp.getPhysicsObjectsOriginal() : [];
  };
  
  useActivate(() => {
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });
  
  let wearing = false;
  useWear(e => {
    const {wear} = e;
    if (bowApp) {
      bowApp.position.copy(app.position);
      bowApp.quaternion.copy(app.quaternion);
      bowApp.scale.copy(app.scale);
      bowApp.updateMatrixWorld();
      
      bowApp.dispatchEvent({
        type: 'wearupdate',
        wear,
      });
    }
    wearing = wear;
  });
  
  useUse(e => {
    if (e.use && bowApp) {
      bowApp.use();
    }
  });

  useFrame(({timestamp, timeDiff}) => {
    if (!wearing) {
      if (bowApp) {
        bowApp.position.copy(app.position);
        bowApp.quaternion.copy(app.quaternion);
        bowApp.updateMatrixWorld();
      }
    } else {
      if (bowApp) {
        app.position.copy(bowApp.position);
        app.quaternion.copy(bowApp.quaternion);
        app.updateMatrixWorld();
      }
    }
    for (const arrowApp of arrowApps) {
      arrowApp.updatePhysics(timestamp, timeDiff);
    }
  });
  
  useCleanup(() => {
    scene.remove(bowApp);
  });

  return app;
};