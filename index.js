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
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localMatrix = new THREE.Matrix4();

// const rightQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.PI/2);
const zeroVector = new THREE.Vector3(0, 0, 0);
const upVector = new THREE.Vector3(0, 1, 0);
const gravity = new THREE.Vector3(0, -9.8, 0);
const emptyArray = [];
const fnEmptyArray = () => emptyArray;
const arrowLength = 0.3;

const _setQuaternionFromVelocity = (quaternion, velocity) => quaternion.setFromRotationMatrix(
  localMatrix.lookAt(
    zeroVector,
    velocity,
    upVector
  )
);

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
            "quaternion": [0.5, -0.4999999999999999, -0.5, 0.5000000000000001],
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
        // arrowMesh.quaternion.premultiply(rightQuaternion);
        arrowMesh.frustumCulled = false;
        arrowApp.add(arrowMesh);

        const tip = new THREE.Object3D();
        tip.position.set(0, 0, -arrowLength/2);
        // tip.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI/2);
        arrowApp.add(tip);
        arrowApp.tip = tip;

        arrowApp.velocity = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(
            new THREE.Quaternion()
              .setFromRotationMatrix(bowApp.matrixWorld)
              // .premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2))
          );
        
        arrowApp.updatePhysics = (timestamp, timeDiff) => {
          const timeDiffS = timeDiff / 1000;
          
          // console.log('add', arrowApp.id, arrowApp.position.toArray().join(','), localVector.toArray().join(','));

          const moveDistance = arrowApp.velocity.length() * timeDiffS;
          if (moveDistance > 0) {
            arrowApp.tip.matrixWorld.decompose(localVector, localQuaternion, localVector2);
            const collision = physics.raycast(
              localVector,
              localQuaternion
            );

            _setQuaternionFromVelocity(arrowApp.quaternion, arrowApp.velocity);
            const normalizedVelocity = localVector3.copy(arrowApp.velocity)
              .normalize();

            let moveFactor;
            if (collision && collision.distance <= moveDistance) {
              moveFactor = collision.distance;
              arrowApp.velocity.setScalar(0);
            } else {
              moveFactor = moveDistance;
              arrowApp.velocity.add(
                localVector4.copy(gravity)
                  .multiplyScalar(timeDiffS)
              );
            }
            arrowApp.position.add(
              localVector4.copy(normalizedVelocity)
                .multiplyScalar(moveFactor)
            );
          }

          arrowApp.updateMatrixWorld();
        };

        return arrowApp;
      };

      bowApp.addEventListener('use', e => {
        // console.log('got bow use', bowApp);
        const arrowApp = _createArrowApp();
        
        scene.add(arrowApp);
        arrowApp.position.copy(bowApp.position);
        // arrowApp.quaternion.copy(bowApp.quaternion);
        _setQuaternionFromVelocity(arrowApp.quaternion, arrowApp.velocity);
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
      /* bowApp.position.copy(app.position);
      bowApp.scale.copy(app.scale);
      bowApp.updateMatrixWorld(); */
      
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